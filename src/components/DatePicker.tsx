"use client";

import { useState } from "react";
import { monthGrid, weekdayLabels, todayUTC } from "@/lib/trip-calendar";

/// Picking when a trip happens, by pointing at it.
///
/// The same calendar the app draws, from the same shared helpers — a month
/// grid answers "which day of the week is that" and "is the museum day a
/// Monday" at a glance, which a box reading mm/dd/yyyy does not. The app had
/// to draw its own because a native picker is a native module; the website
/// keeps it so the two do not answer the same question in two different
/// shapes.
///
/// Dates are UTC midnight throughout, as everywhere else that touches a trip:
/// a date picker gives a date, not an instant.

const DAY_MS = 86_400_000;

function iso(time: number) {
  return new Date(time).toISOString().slice(0, 10);
}

export default function DatePicker({
  start,
  end = "",
  onChange,
  single = false,
  emptyHint,
}: {
  /// "2026-09-18", or "" for unset.
  start: string;
  end?: string;
  onChange: (next: { start: string; end: string }) => void;
  /// One date rather than a range — a trip whose length is already decided
  /// somewhere else has no second end to ask for.
  single?: boolean;
  /// What the one date is for. Shown under the grid before anything is picked.
  emptyHint?: string;
}) {
  /// Which month is on screen. Opens on the trip's own month when it has one,
  /// so editing a trip does not begin by paging back to find it.
  const opening = start ? new Date(`${start}T00:00:00Z`) : new Date(todayUTC());
  const [cursor, setCursor] = useState({
    year: opening.getUTCFullYear(),
    month: opening.getUTCMonth(),
  });

  const grid = monthGrid(cursor.year, cursor.month);
  const headings = weekdayLabels();
  const today = todayUTC();

  const startTime = start ? Date.parse(`${start}T00:00:00Z`) : null;
  const endTime = end ? Date.parse(`${end}T00:00:00Z`) : null;

  function pick(time: number) {
    if (single) {
      // Clicking the chosen day again takes it off, which is the only way to
      // say "no date after all" without a button nobody looks for.
      onChange({ start: startTime === time ? "" : iso(time), end: "" });
      return;
    }
    // First click sets the start, a second extends to a range, a third starts
    // again — which is what reaching for a different week means.
    if (startTime === null || endTime !== null) {
      onChange({ start: iso(time), end: "" });
      return;
    }
    if (time < startTime) {
      onChange({ start: iso(time), end: iso(startTime) });
      return;
    }
    onChange({ start: iso(startTime), end: iso(time) });
  }

  function step(by: number) {
    const next = new Date(Date.UTC(cursor.year, cursor.month + by, 1));
    setCursor({ year: next.getUTCFullYear(), month: next.getUTCMonth() });
  }

  return (
    <div className="rounded-lg border border-line p-2">
      <div className="flex items-center justify-between px-1 py-1">
        <button
          type="button"
          className="px-2 text-lg leading-none text-accent-text hover:opacity-70"
          aria-label="Previous month"
          onClick={() => step(-1)}
        >
          ‹
        </button>
        <span className="text-sm font-semibold">{grid.label}</span>
        <button
          type="button"
          className="px-2 text-lg leading-none text-accent-text hover:opacity-70"
          aria-label="Next month"
          onClick={() => step(1)}
        >
          ›
        </button>
      </div>

      <div className="grid grid-cols-7 gap-y-0.5">
        {headings.map((label, i) => (
          <div key={`h-${i}`} className="py-1 text-center text-xs text-muted">
            {label.slice(0, 1)}
          </div>
        ))}

        {grid.weeks.flat().map((cell, i) => {
          if (cell.time === null) return <div key={i} />;

          const isStart = startTime !== null && cell.time === startTime;
          const isEnd = endTime !== null && cell.time === endTime;
          const inRange =
            startTime !== null && endTime !== null && cell.time > startTime && cell.time < endTime;
          const chosen = isStart || isEnd;

          return (
            <div key={i} className="flex justify-center py-0.5">
              <button
                type="button"
                aria-label={iso(cell.time)}
                aria-pressed={chosen}
                onClick={() => pick(cell.time!)}
                className={`flex size-9 items-center justify-center rounded-lg text-sm ${
                  chosen
                    ? "bg-primary font-semibold text-on-primary"
                    : inRange
                      ? "bg-brand-surface"
                      : cell.time === today
                        ? "border border-primary"
                        : "hover:bg-foreground/5"
                }`}
              >
                {cell.dayOfMonth}
              </button>
            </div>
          );
        })}
      </div>

      <p className="mt-1 px-1 text-xs text-muted">
        {single
          ? start
            ? `${start} · click again to clear`
            : (emptyHint ?? "Click a day, or leave it for no date.")
          : !start
            ? "Click the first day."
            : !end
              ? "Click the last day, or leave it for a single day."
              : `${start} → ${end} · ${
                  Math.round((Date.parse(end) - Date.parse(start)) / DAY_MS) + 1
                } days`}
      </p>
    </div>
  );
}
