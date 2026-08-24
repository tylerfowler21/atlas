/// Pure helpers shared by the trip pages. Trip dates are stored as UTC
/// midnight (a date picker gives a date, not an instant), so every read here
/// works in UTC to avoid a day sliding either side of midnight locally.

const DAY_MS = 24 * 60 * 60 * 1000;

export function dayCount(
  trip: { startDate: string | null; endDate: string | null },
  items: { dayIndex: number }[],
): number {
  // A trip is always at least long enough to show every item it already has,
  // so shortening the dates can never strand a stop on an invisible day.
  const fromItems = Math.max(1, ...items.map((i) => i.dayIndex + 1));

  if (trip.startDate && trip.endDate) {
    const span = (Date.parse(trip.endDate) - Date.parse(trip.startDate)) / DAY_MS;
    return Math.max(Math.round(span) + 1, fromItems);
  }
  return fromItems;
}

/// "2026-09-18" from an ISO timestamp, for binding to a <input type="date">.
export function toDateInput(iso: string | null): string {
  return iso ? iso.slice(0, 10) : "";
}

export function dateForDay(
  trip: { startDate: string | null },
  dayIndex: number,
): Date | null {
  if (!trip.startDate) return null;
  return new Date(Date.parse(trip.startDate) + dayIndex * DAY_MS);
}

export function formatDay(date: Date, opts: Intl.DateTimeFormatOptions = {}) {
  return date.toLocaleDateString(undefined, {
    timeZone: "UTC",
    weekday: "short",
    month: "short",
    day: "numeric",
    ...opts,
  });
}

export function formatRange(trip: { startDate: string | null; endDate: string | null }) {
  if (!trip.startDate) return "No dates yet";
  const start = new Date(trip.startDate);
  if (!trip.endDate) return formatDay(start);
  const end = new Date(trip.endDate);
  return `${formatDay(start)} – ${formatDay(end, { weekday: undefined })}`;
}

/// "in 12 days" / "5 days ago" / "happening now", for the trip list.
export function relativeLabel(trip: { startDate: string | null; endDate: string | null }) {
  if (!trip.startDate) return null;

  const today = Date.now();
  const start = Date.parse(trip.startDate);
  const end = trip.endDate ? Date.parse(trip.endDate) + DAY_MS : start + DAY_MS;

  if (today >= start && today < end) return "Happening now";

  const days = Math.round((start - today) / DAY_MS);
  if (days > 0) return days === 1 ? "Tomorrow" : `In ${days} days`;

  const since = Math.round((today - end) / DAY_MS);
  return since <= 1 ? "Just finished" : `${since} days ago`;
}
