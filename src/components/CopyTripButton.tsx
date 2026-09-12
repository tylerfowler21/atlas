"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { dateForDay, dayCount, formatDay } from "@/lib/trips";
import type { PublicItemDTO, PublicTripDTO } from "@/lib/types";

export default function CopyTripButton({
  endpoint,
  signedIn,
  isOwn,
  returnTo,
  trip,
  items,
}: {
  /// Where to POST. A published trip is copied by its id; one somebody sent
  /// you a link to is copied by that link's token, because the token is the
  /// only thing the reader has and the only thing that proves they may.
  endpoint: string;
  signedIn: boolean;
  isOwn: boolean;
  /// This page, so signing in comes back to the trip somebody was reading
  /// rather than dropping them on their own empty map.
  returnTo: string;
  /// The itinerary, for the day picker. The whole trip is what most people
  /// want, so this only ever feeds the second button.
  trip: PublicTripDTO;
  items: PublicItemDTO[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /// Which days are ticked, once somebody has opened the picker. Null while
  /// it is shut — "all of them", which is what the plain button sends.
  const [picked, setPicked] = useState<Set<number> | null>(null);

  /// Day number, its date if the trip has any, and what is on it — enough to
  /// recognise the afternoon you wanted without scrolling back to the plan.
  //
  // Dates are formatted here rather than on the server because they are
  // formatted in the reader's locale, and the server does not know it.
  const days = useMemo(() => {
    const total = dayCount(trip, items);
    return Array.from({ length: total }, (_, index) => {
      const stops = items.filter((i) => i.dayIndex === index);
      const date = dateForDay(trip, index);
      return {
        index,
        date: date ? formatDay(date) : null,
        titles: stops.filter((i) => i.kind !== "travel").map((i) => i.title),
        count: stops.length,
      };
    });
  }, [trip, items]);

  if (isOwn) return null;
  if (!signedIn) {
    // "Sign in" is the wrong word for somebody who has never been here, and
    // most people reading a shared trip have not.
    return (
      <a
        href={`/signin?next=${encodeURIComponent(returnTo)}`}
        className="btn btn-accent"
      >
        Save this trip
      </a>
    );
  }

  async function copy(only?: number[]) {
    setBusy(true);
    setError(null);

    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(only ? { days: only } : {}),
    });
    const body = await res.json().catch(() => ({}));

    if (!res.ok) {
      setBusy(false);
      setError(body.error ?? "Could not copy that trip");
      return;
    }
    router.push(`/trips/${body.tripId}`);
    router.refresh();
  }

  function toggle(index: number) {
    setPicked((current) => {
      const next = new Set(current ?? []);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }

  const chosen = picked ? [...picked].sort((a, b) => a - b) : [];

  return (
    <div className="basis-full">
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className="btn btn-accent" disabled={busy} onClick={() => void copy()}>
          <span aria-hidden>⧉</span>
          {busy && !picked ? "Copying…" : "Copy this trip"}
        </button>
        {/* Taking part of somebody's week is the rarer wish, so it waits
            behind a second button rather than taxing every copy with a
            step. */}
        {days.length > 1 && (
          <button
            type="button"
            className="btn btn-ghost"
            aria-expanded={picked !== null}
            onClick={() => setPicked((current) => (current ? null : new Set()))}
          >
            {picked ? "Never mind" : "Choose days…"}
          </button>
        )}
      </div>

      {picked && (
        <div className="card mt-2 max-w-md p-3">
          <p className="text-xs text-muted">
            Pick the days you want. They arrive renumbered from one, on a trip of
            their own.
          </p>
          <ul className="mt-2 flex flex-col gap-1">
            {days.map((day) => (
              <li key={day.index}>
                <label className="flex cursor-pointer items-start gap-2 rounded-xl p-1.5 hover:bg-[color-mix(in_srgb,var(--foreground)_5%,transparent)]">
                  <input
                    type="checkbox"
                    className="mt-0.5"
                    // The label's own text is two lines of spans, which does
                    // not reliably name the box. Spell it out.
                    aria-label={`Day ${day.index + 1}${day.date ? `, ${day.date}` : ""}`}
                    checked={picked.has(day.index)}
                    onChange={() => toggle(day.index)}
                  />
                  <span className="min-w-0">
                    <span className="text-sm font-medium">Day {day.index + 1}</span>
                    {day.date && <span className="text-xs text-muted"> · {day.date}</span>}
                    <span className="block truncate text-xs text-muted">
                      {day.titles.length > 0 ? day.titles.join(" · ") : "Nothing planned"}
                    </span>
                  </span>
                </label>
              </li>
            ))}
          </ul>
          <button
            type="button"
            className="btn btn-primary mt-2 w-full justify-center"
            disabled={busy || chosen.length === 0}
            onClick={() => void copy(chosen)}
          >
            {busy
              ? "Copying…"
              : chosen.length === 0
                ? "Pick a day"
                : `Copy ${chosen.length} ${chosen.length === 1 ? "day" : "days"}`}
          </button>
        </div>
      )}

      {error && <p className="mt-1 text-xs text-danger">{error}</p>}
    </div>
  );
}
