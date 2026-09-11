/// Reminding somebody about a booking before it lapses.
///
/// Scheduled on the phone rather than pushed from a server. A local
/// notification needs no push token, no per-device registry and no scheduled
/// job — the phone is told once and does the rest, including while the app is
/// closed. For a deadline the person set on that same phone a minute earlier,
/// a server round trip buys nothing.
///
/// The trade is honest and worth knowing: these live on one device. A deadline
/// set on the website is not reminded about, and reinstalling clears them
/// until the trip is opened again. Real push is the answer when people travel
/// together and expect each other's deadlines to reach them; it is a much
/// larger thing, and this is not a worse version of it so much as a different
/// one.
import { deadlineLabel } from "@/lib/booking-deadline";

type Notifications = typeof import("expo-notifications");

/// Loaded lazily, like every other native module here: a build made before it
/// was added does not contain it, and a top-level import would take the app
/// down on launch over a reminder nobody had asked for.
async function load(): Promise<Notifications | null> {
  try {
    return await import("expo-notifications");
  } catch {
    return null;
  }
}

/// Nine in the morning, local time. A booking deadline is a thing to act on
/// during a day, and a notification at midnight is one you wake up to having
/// already dismissed.
const HOUR = 9;

export type Reminder = {
  /// The itinerary item, which doubles as the notification's identifier so
  /// rescheduling replaces rather than accumulates.
  id: string;
  title: string;
  /// ISO date.
  bookBy: string;
  tripTitle: string;
};

export async function permissionGranted(): Promise<boolean> {
  const N = await load();
  if (!N) return false;
  const existing = await N.getPermissionsAsync();
  if (existing.granted) return true;
  if (!existing.canAskAgain) return false;
  const asked = await N.requestPermissionsAsync();
  return asked.granted;
}

/// Replaces the reminders for one trip with exactly these.
///
/// Cancelling by identifier first, because the alternative is a notification
/// for a booking that was made a week ago — which teaches people to ignore
/// them, and an ignored reminder is worse than none.
export async function syncReminders(reminders: Reminder[], allIds: string[]) {
  const N = await load();
  if (!N) return;

  for (const id of allIds) {
    try {
      await N.cancelScheduledNotificationAsync(id);
    } catch {
      // Nothing scheduled under that id, which is the common case.
    }
  }

  if (reminders.length === 0) return;
  if (!(await permissionGranted())) return;

  for (const reminder of reminders) {
    const due = new Date(reminder.bookBy);
    const when = new Date(
      due.getUTCFullYear(),
      due.getUTCMonth(),
      due.getUTCDate(),
      HOUR,
      0,
      0,
    );
    // A deadline already past cannot be reminded about; the list shows it in
    // red instead.
    if (when.getTime() <= Date.now()) continue;

    try {
      await N.scheduleNotificationAsync({
        identifier: reminder.id,
        content: {
          title: reminder.title,
          body: `${deadlineLabel(reminder.bookBy, when)} · ${reminder.tripTitle}`,
        },
        trigger: { type: N.SchedulableTriggerInputTypes.DATE, date: when },
      });
    } catch {
      // One reminder that cannot be scheduled should not cost the others.
    }
  }
}
