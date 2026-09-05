"use client";

import { tripCalendar, weekdayLabels, todayUTC } from "@/lib/trip-calendar";

/// The trip's days on a real calendar, in the months they actually fall in.
///
/// "Day 3" is a number you have to convert before it means anything. A grid
/// does the converting: the weekend is where weekends are, the gap before the
/// flight home is a visible gap, and a day that lands on a Monday looks like a
/// Monday — which is when you remember the museum is shut.
export default function TripCalendar({
  startDate,
  days,
  color,
  activeDay,
  counts,
  onPick,
}: {
  startDate: string;
  days: number;
  /// The trip's own colour, so the highlighted block matches its pins.
  color: string;
  activeDay: number;
  /// Stops per day, indexed by day. Drawn as a dot, not a number: the question
  /// a calendar answers is "is anything on that day", and the count is already
  /// on the day itself.
  counts: number[];
  onPick: (dayIndex: number) => void;
}) {
  const months = tripCalendar(startDate, days);
  const today = todayUTC();
  const headings = weekdayLabels();

  return (
    <div className="space-y-3">
      {months.map((month) => (
        <div key={month.label}>
          <p className="text-xs font-medium">{month.label}</p>

          <div className="mt-1 grid grid-cols-7 gap-0.5">
            {headings.map((label) => (
              <div key={label} className="py-1 text-center text-[10px] text-muted">
                {/* One letter on the narrowest screens, where seven short
                    words do not fit and wrapping them breaks the grid. */}
                <span className="hidden sm:inline">{label}</span>
                <span className="sm:hidden">{label.slice(0, 1)}</span>
              </div>
            ))}

            {month.weeks.flat().map((cell, i) => {
              if (cell.dayOfMonth === null) return <div key={i} />;

              const inTrip = cell.dayIndex !== null;
              const on = cell.dayIndex === activeDay;
              const isToday = cell.time === today;
              const has = inTrip && (counts[cell.dayIndex!] ?? 0) > 0;

              if (!inTrip) {
                return (
                  <div
                    key={i}
                    className={`rounded py-1.5 text-center text-xs text-muted/50 ${
                      isToday ? "ring-1 ring-line" : ""
                    }`}
                  >
                    {cell.dayOfMonth}
                  </div>
                );
              }

              return (
                <button
                  key={i}
                  type="button"
                  aria-label={`Day ${cell.dayIndex! + 1}`}
                  aria-current={on ? "date" : undefined}
                  onClick={() => onPick(cell.dayIndex!)}
                  className={`rounded py-1.5 text-center text-xs transition-colors ${
                    on ? "font-semibold text-white" : "font-medium"
                  } ${isToday && !on ? "ring-1 ring-inset" : ""}`}
                  style={{
                    // The trip's colour filled in for the day being edited and
                    // washed out for the rest, so the block of days reads as
                    // one thing and the current one still stands out of it.
                    backgroundColor: on ? color : `${color}1f`,
                    ...(isToday && !on ? { boxShadow: `inset 0 0 0 1px ${color}` } : {}),
                  }}
                >
                  {cell.dayOfMonth}
                  {/* Marks a day with something planned. Kept the same size on
                      an empty day so the numbers do not jump about. */}
                  <span
                    aria-hidden
                    className="mx-auto mt-0.5 block size-1 rounded-full"
                    style={{ backgroundColor: has ? (on ? "#fff" : color) : "transparent" }}
                  />
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
