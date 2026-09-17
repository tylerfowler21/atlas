/// The two things this app reminds anybody about, and both on the phone.
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

/// Six in the evening, the day before leaving. Packing is a thing people do at
/// night with a suitcase open, and a reminder at nine in the morning is one
/// they read at work and have forgotten by the time they are home.
const PACKING_HOUR = 18;

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

/// One reminder per trip, the evening before it starts: what is still not in
/// the bag.
///
/// Derived rather than set. Nobody puts a date on a pair of socks, and a list
/// of twenty items with twenty reminders is a phone worth silencing — so the
/// only date that matters is the one the trip already has, and the only
/// question is whether anything is left.
///
/// Rescheduled on every read of the trip, like the booking ones, because the
/// thing that most often changes is somebody else ticking items off. The
/// identifier is the trip's, so a reschedule replaces rather than stacks, and
/// an empty list cancels instead of reminding you about nothing.
export async function syncPackingReminder(
  trip: { id: string; title: string; startDate: string | null },
  unpacked: number,
) {
  const N = await load();
  if (!N) return;

  const id = `packing:${trip.id}`;
  try {
    await N.cancelScheduledNotificationAsync(id);
  } catch {
    // Nothing scheduled under that id, which is the common case.
  }

  if (unpacked === 0 || !trip.startDate) return;

  const starts = new Date(trip.startDate);
  const when = new Date(
    starts.getUTCFullYear(),
    starts.getUTCMonth(),
    starts.getUTCDate() - 1,
    PACKING_HOUR,
    0,
    0,
  );
  // Checked before asking for permission, so a trip that left last month does
  // not produce a system prompt for a notification that would never fire.
  if (when.getTime() <= Date.now()) return;
  if (!(await permissionGranted())) return;

  try {
    await N.scheduleNotificationAsync({
      identifier: id,
      content: {
        title: `Packing for ${trip.title}`,
        body:
          unpacked === 1
            ? "One thing still on the list."
            : `${unpacked} things still on the list.`,
      },
      trigger: { type: N.SchedulableTriggerInputTypes.DATE, date: when },
    });
  } catch {
    // A reminder that cannot be scheduled is not worth failing a screen over.
  }
}
