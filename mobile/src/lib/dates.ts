/// Formatting for date-only values.
///
/// A trip's dates, a lived-in period and a journal entry's day are days, not
/// moments — they are stored at UTC midnight. Formatted in a western timezone
/// that lands on the previous evening, so a stay beginning 1 January 2015
/// renders as 2014 and a trip starting on the 18th shows the 17th.
///
/// Everything here formats in UTC, which is what the website does, so a date
/// reads the same on both.
export function formatDay(iso: string, opts: Intl.DateTimeFormatOptions = {}) {
  return new Date(iso).toLocaleDateString(undefined, {
    timeZone: "UTC",
    day: "numeric",
    month: "short",
    year: "numeric",
    ...opts,
  });
}

export function year(iso: string) {
  return new Date(iso).getUTCFullYear();
}

/// The day `index` days after a trip's start, still as a date rather than a
/// moment — added in milliseconds so it cannot drift across a daylight-saving
/// boundary the way setDate would.
export function dayAfter(startIso: string, index: number) {
  return new Date(Date.parse(startIso) + index * 86_400_000);
}

/// A trip runs from its start date; without one it is still a list of days,
/// just unlabelled ones. Matching the website, which lets a trip exist before
/// anyone has decided when it happens.
export function dayLabel(
  trip: { startDate: string | null },
  index: number,
): string {
  if (!trip.startDate) return `Day ${index + 1}`;
  return formatDay(dayAfter(trip.startDate, index).toISOString(), {
    weekday: "short",
    year: undefined,
  });
}
