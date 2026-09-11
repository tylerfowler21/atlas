/// How a booking deadline reads, and how urgent it is.
///
/// The spreadsheet this app grew out of carried these as notes — "book 3 days
/// before", "book 1-3 days before" — which is a deadline written somewhere
/// nothing can act on. This is the same information in a form that can be
/// sorted, coloured and reminded about.
const DAY_MS = 86_400_000;

export type Urgency = "overdue" | "soon" | "later";

/// Whole days between today and the deadline, in the viewer's own timezone.
/// Both ends are flattened to midnight: "tomorrow" should not become "today"
/// because it is late in the evening.
export function daysUntil(bookBy: string, now = new Date()): number {
  const due = new Date(bookBy);
  const dueMidnight = Date.UTC(due.getUTCFullYear(), due.getUTCMonth(), due.getUTCDate());
  const nowMidnight = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((dueMidnight - nowMidnight) / DAY_MS);
}

export function urgencyOf(bookBy: string, now = new Date()): Urgency {
  const days = daysUntil(bookBy, now);
  if (days < 0) return "overdue";
  // A week is the point at which a deadline is worth acting on rather than
  // noting: most things can still be booked, and leaving it later is how they
  // stop being bookable.
  if (days <= 7) return "soon";
  return "later";
}

/// "Overdue", "Today", "Tomorrow", "In 5 days", "12 Mar".
export function deadlineLabel(bookBy: string, now = new Date()): string {
  const days = daysUntil(bookBy, now);
  if (days < 0) return days === -1 ? "Was due yesterday" : `${-days} days overdue`;
  if (days === 0) return "Book today";
  if (days === 1) return "Book by tomorrow";
  if (days <= 14) return `Book within ${days} days`;
  return `Book by ${new Date(bookBy).toLocaleDateString(undefined, {
    timeZone: "UTC",
    day: "numeric",
    month: "short",
  })}`;
}
