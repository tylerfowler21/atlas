"use client";

import { useState } from "react";
import { TRIP_STYLES } from "@/lib/trip-styles";
import DestinationField from "@/components/DestinationField";
import DatePicker from "@/components/DatePicker";
import { dayAfter } from "@/lib/trip-calendar";
import type { SearchResult } from "@/lib/types";

/// Asking for a first draft of a trip.
///
/// What comes back is text in the same box a pasted itinerary goes into, and
/// it goes through the same review: every place looked up against a real
/// gazetteer, shown with what was found, confirmed one at a time. That is the
/// whole safety story. A model will name a restaurant that closed in 2019 as
/// confidently as one that is open, and the difference shows up as a place that
/// will not resolve rather than as a pin on somebody's map.
///
/// The cities are the ones already picked above rather than typed again here.
/// Two boxes both asking where you are going is how a trip ends up drafted for
/// Lisbon and saved under Canada.
export default function DraftTrip({
  cities,
  onCities,
  onPick,
  startDate,
  onStartDate,
  onDrafted,
}: {
  /// Where they said they are going, in order. Empty until they say.
  ///
  /// Held by the importer rather than here, because the trip it eventually
  /// saves needs them — but asked for here, because this is the form somebody
  /// is actually filling in.
  cities: string[];
  onCities: (next: string[]) => void;
  onPick: (label: string, result: SearchResult) => void;
  startDate: string;
  onStartDate: (date: string) => void;
  /// Everything the drafted trip is, not only its itinerary: the summary
  /// becomes the trip's notes and the length gives it an end date, which is
  /// the difference between a saved trip and a list of days.
  onDrafted: (draft: {
    text: string;
    title: string;
    destination: string;
    summary: string;
    days: number;
  }) => void;
}) {
  /// Days per city, keyed by the city as it is written above.
  ///
  /// Kept as a map rather than a list so adding a third city does not disturb
  /// the two numbers already set, and removing one does not shift the rest by
  /// one place.
  const [dayFor, setDayFor] = useState<Record<string, number>>({});
  const [styles, setStyles] = useState<string[]>([]);
  const [interests, setInterests] = useState("");
  const [pace, setPace] = useState<"relaxed" | "balanced" | "packed">("balanced");

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<string | null>(null);

  /// Three days is what somebody means by "a few days somewhere", and it is a
  /// number they can see and change rather than one they have to supply.
  const DEFAULT_DAYS = 3;
  const daysIn = (city: string) => dayFor[city] ?? DEFAULT_DAYS;

  const legs = cities.map((city) => ({ city, days: daysIn(city) }));
  const total = legs.reduce((sum, leg) => sum + leg.days, 0);
  /// A fortnight is the limit at the other end too, and saying so before the
  /// button is pressed beats a 400 afterwards.
  const tooLong = total > 14;

  async function draft() {
    setBusy(true);
    setError(null);
    setSummary(null);

    try {
      const res = await fetch("/api/trips/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          destination: cities.join(", "),
          days: total,
          legs,
          styles,
          interests: interests.trim() || null,
          pace,
        }),
      });
      const body = await res.json();

      if (!res.ok) {
        setError(body.error ?? "That draft didn't come back");
        return;
      }
      setSummary(
        `${body.stops.length} stops across ${total} ${total === 1 ? "day" : "days"}. ${body.summary}`,
      );
      onDrafted({
        text: body.text,
        title: body.title,
        destination: body.destination,
        summary: body.summary,
        days: total,
      });
    } catch {
      setError("That draft didn't come back");
    } finally {
      setBusy(false);
    }
  }

  /// The last day, worked out rather than asked for, so the dates and the day
  /// counts cannot contradict each other.
  const lastDay = startDate && total > 0 ? dayAfter(startDate, total - 1) : "";

  return (
    <div className="space-y-6">
      {/* One question after another, in the order somebody answers them.
          Where, how long, when, what kind — the same run the app asks, so the
          two do not put the same question in two different shapes. */}
      <section>
        <h2 className="mb-2 text-sm font-semibold">
          Where, and how long in each
          {cities.length > 1 && (
            <span className="ml-2 text-xs font-normal text-muted">
              {total} {total === 1 ? "day" : "days"} altogether
            </span>
          )}
        </h2>

        <DestinationField
          value={cities}
          onChange={onCities}
          onPick={onPick}
          placeholder="Montréal"
        />

        {cities.length === 0 ? (
          <p className="mt-2 text-xs text-muted">
            Add as many as the trip visits, in the order you&apos;ll go. Each
            one gets its own number of days.
          </p>
        ) : (
          <div className="mt-3 space-y-1.5">
            {cities.map((city) => (
              <div key={city} className="flex items-center gap-3">
                <span className="min-w-0 flex-1 truncate text-sm">{city}</span>
                <input
                  type="number"
                  min={1}
                  max={14}
                  aria-label={`Days in ${city}`}
                  className="input w-20 shrink-0 text-center"
                  value={daysIn(city)}
                  onChange={(e) =>
                    setDayFor((current) => ({
                      ...current,
                      [city]: Math.max(1, Math.min(14, Number(e.target.value) || 1)),
                    }))
                  }
                />
                <span className="w-10 shrink-0 text-xs text-muted">
                  {daysIn(city) === 1 ? "day" : "days"}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* The last day follows from the days above, so only the first is asked
          for — and it is a calendar rather than a box wanting mm/dd/yyyy,
          because "is that a Monday" is half of what somebody is checking. */}
      <section>
        <h2 className="mb-2 text-sm font-semibold">
          When
          {lastDay && (
            <span className="ml-2 text-xs font-normal text-muted">
              through {lastDay}
            </span>
          )}
        </h2>
        <DatePicker
          single
          start={startDate}
          // The whole trip shaded, not only the day it starts. The days above
          // already say how long it runs, so the calendar can show it —
          // clicking still only moves the first day.
          end={lastDay}
          onChange={(next) => onStartDate(next.start)}
          emptyHint="Click the first day, or leave it for a trip with no dates."
        />
      </section>

      {/* The handful of answers that change the shape of the itinerary rather
          than its details. A trip with a four-year-old and a trip built around
          dinner are different plans of the same city. */}
      <section>
        <h2 className="mb-2 text-sm font-semibold">
          What kind of trip <span className="text-xs font-normal text-muted">(pick any)</span>
        </h2>
        <div className="flex flex-wrap gap-1.5">
          {TRIP_STYLES.map((style) => {
            const on = styles.includes(style.id);
            return (
              <button
                key={style.id}
                type="button"
                className={`chip ${on ? "is-on" : ""}`}
                aria-pressed={on}
                onClick={() =>
                  setStyles((current) =>
                    on ? current.filter((id) => id !== style.id) : [...current, style.id],
                  )
                }
              >
                {style.label}
              </button>
            );
          })}
        </div>
      </section>

      <section>
        <h2 className="mb-2 text-sm font-semibold">
          Anything else <span className="text-xs font-normal text-muted">(optional)</span>
        </h2>
        <input
          className="input"
          placeholder="seafood, walking, not too many museums"
          value={interests}
          onChange={(e) => setInterests(e.target.value)}
        />
      </section>

      <section>
        <h2 className="mb-2 text-sm font-semibold">Pace</h2>
        <div className="flex flex-wrap gap-1.5">
          {(
            [
              ["relaxed", "Relaxed"],
              ["balanced", "Balanced"],
              ["packed", "Packed"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              className={`chip ${pace === id ? "is-on" : ""}`}
              aria-pressed={pace === id}
              onClick={() => setPace(id)}
            >
              {label}
            </button>
          ))}
        </div>
      </section>

      {error && <p className="text-xs text-red-500">{error}</p>}
      {summary && <p className="text-xs text-muted">{summary}</p>}

      <div className="space-y-2">
        <button
          type="button"
          className="btn btn-primary w-full justify-center py-3 text-sm"
          disabled={busy || cities.length === 0 || tooLong}
          onClick={() => void draft()}
        >
          {busy ? "Drafting…" : "Draft me an itinerary"}
        </button>
        {/* Said beside the button that is off, rather than left to be guessed
            at — the same amber hint the import button got. */}
        {cities.length === 0 && (
          <span className="text-xs text-amber-600 dark:text-amber-400">
            Say where you&apos;re going first.
          </span>
        )}
        {tooLong && (
          <span className="text-xs text-amber-600 dark:text-amber-400">
            That&apos;s {total} days — a fortnight is the most it will draft at once.
          </span>
        )}
      </div>

      <p className="text-xs text-muted">
        Nothing is saved until you have looked at it — every place is checked
        against a real map, and anything it invented simply won&apos;t be found.
      </p>
    </div>
  );
}
