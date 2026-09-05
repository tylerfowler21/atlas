/// Mirrored from the website's src/lib/trip-calendar.ts — edit that copy and
/// run `npm run sync-mirror`. Both clients draw the same grid, so a day that
/// is a Saturday on the laptop is a Saturday on the phone.
const DAY_MS = 24 * 60 * 60 * 1000;

export type CalendarCell = {
  /// UTC midnight for this square, or null for the blanks that pad a month out
  /// to whole weeks.
  time: number | null;
  dayOfMonth: number | null;
  /// 0-based day of the trip, or null when the date is outside it. This is
  /// what makes the grid a trip rather than a calendar.
  dayIndex: number | null;
};

export type CalendarMonth = {
  /// "September 2026"
  label: string;
  weeks: CalendarCell[][];
};

function monthLabel(time: number) {
  return new Date(time).toLocaleDateString(undefined, {
    timeZone: "UTC",
    month: "long",
    year: "numeric",
  });
}

/// The weekday headings, starting on whichever day the grid starts on.
export function weekdayLabels(weekStartsOn = 0): string[] {
  // 4 January 1970 was a Sunday, so this counts from a known one rather than
  // from today, which would drift.
  const sunday = Date.UTC(1970, 0, 4);
  return Array.from({ length: 7 }, (_, i) =>
    new Date(sunday + ((i + weekStartsOn) % 7) * DAY_MS).toLocaleDateString(undefined, {
      timeZone: "UTC",
      weekday: "short",
    }),
  );
}

/// Every month the trip touches, as weeks of squares.
///
/// A trip that runs from the 29th to the 3rd spans two months and gets two
/// grids, because splicing them into one would put two different 1sts in the
/// same square.
export function tripCalendar(
  startDate: string,
  days: number,
  weekStartsOn = 0,
): CalendarMonth[] {
  const start = Date.parse(startDate);
  if (Number.isNaN(start) || days < 1) return [];

  const first = new Date(start);
  const last = new Date(start + (days - 1) * DAY_MS);

  const months: CalendarMonth[] = [];
  let year = first.getUTCFullYear();
  let month = first.getUTCMonth();

  for (;;) {
    const firstOfMonth = Date.UTC(year, month, 1);
    // Day 0 of the next month is the last day of this one.
    const length = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();

    const cells: CalendarCell[] = [];
    const lead = (new Date(firstOfMonth).getUTCDay() - weekStartsOn + 7) % 7;
    for (let i = 0; i < lead; i += 1) {
      cells.push({ time: null, dayOfMonth: null, dayIndex: null });
    }

    for (let d = 1; d <= length; d += 1) {
      const time = Date.UTC(year, month, d);
      const offset = Math.round((time - start) / DAY_MS);
      cells.push({
        time,
        dayOfMonth: d,
        dayIndex: offset >= 0 && offset < days ? offset : null,
      });
    }

    // Padded to whole weeks so every row has seven squares and the columns
    // line up under their headings.
    while (cells.length % 7 !== 0) {
      cells.push({ time: null, dayOfMonth: null, dayIndex: null });
    }

    const weeks: CalendarCell[][] = [];
    for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
    months.push({ label: monthLabel(firstOfMonth), weeks });

    if (year === last.getUTCFullYear() && month === last.getUTCMonth()) break;
    month += 1;
    if (month > 11) {
      month = 0;
      year += 1;
    }
  }

  return months;
}

/// Today, as UTC midnight, so it can be compared with a cell's time.
export function todayUTC(now = new Date()): number {
  return Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
}
