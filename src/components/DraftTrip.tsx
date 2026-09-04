"use client";

import { useState } from "react";

/// Asking for a first draft of a trip.
///
/// What comes back is text in the same box a pasted itinerary goes into, and
/// it goes through the same review: every place looked up against a real
/// gazetteer, shown with what was found, confirmed one at a time. That is the
/// whole safety story. A model will name a restaurant that closed in 2019 as
/// confidently as one that is open, and the difference shows up as a place that
/// will not resolve rather than as a pin on somebody's map.
export default function DraftTrip({
  onDrafted,
}: {
  onDrafted: (draft: { text: string; title: string; destination: string }) => void;
}) {
  const [destination, setDestination] = useState("");
  const [days, setDays] = useState(3);
  const [interests, setInterests] = useState("");
  const [pace, setPace] = useState<"relaxed" | "balanced" | "packed">("balanced");

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<string | null>(null);

  async function draft() {
    setBusy(true);
    setError(null);
    setSummary(null);

    try {
      const res = await fetch("/api/trips/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          destination: destination.trim(),
          days,
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
        `${body.stops.length} stops across ${days} ${days === 1 ? "day" : "days"}. ${body.summary}`,
      );
      onDrafted({ text: body.text, title: body.title, destination: body.destination });
    } catch {
      setError("That draft didn't come back");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-xs text-muted">
          Where
          <input
            className="input mt-1"
            placeholder="Lisbon"
            value={destination}
            onChange={(e) => setDestination(e.target.value)}
          />
        </label>
        <label className="text-xs text-muted">
          How many days
          <input
            type="number"
            min={1}
            max={14}
            className="input mt-1"
            value={days}
            onChange={(e) => setDays(Math.max(1, Math.min(14, Number(e.target.value) || 1)))}
          />
        </label>
      </div>

      <label className="block text-xs text-muted">
        What you&apos;re into (optional)
        <input
          className="input mt-1"
          placeholder="seafood, walking, not too many museums"
          value={interests}
          onChange={(e) => setInterests(e.target.value)}
        />
      </label>

      <div>
        <p className="mb-1.5 text-xs text-muted">Pace</p>
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
      </div>

      {error && <p className="text-xs text-red-500">{error}</p>}
      {summary && <p className="text-xs text-muted">{summary}</p>}

      <button
        type="button"
        className="btn btn-primary"
        disabled={busy || destination.trim().length < 2}
        onClick={() => void draft()}
      >
        {busy ? "Drafting…" : "Draft me an itinerary"}
      </button>

      <p className="text-xs text-muted">
        It writes a first draft into the box below. Nothing is saved until you
        have looked at it — every place is checked against a real map, and
        anything it invented simply won&apos;t be found.
      </p>
    </div>
  );
}
