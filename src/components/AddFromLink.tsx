"use client";

import { useState } from "react";
import ImportLink from "@/components/ImportLink";
import { parseItinerary } from "@/lib/itinerary-parser";
import { searchPlaces } from "@/lib/search-places";
import { dateForDay, formatDay } from "@/lib/trips";
import type { SearchResult, TripDTO } from "@/lib/types";

/// Adding places off a reel to the trip you are already looking at.
///
/// This used to send you to the importer, which is a page headed "Add a trip
/// you've taken" and has no notion of which day you meant. Both wrong for
/// somebody standing in a trip they are planning: they know the trip, they
/// know the day, and the only question is which places.
///
/// The checking is not skipped for being in a smaller window. Every place the
/// caption named is looked up against a real gazetteer and shown with what
/// came back, one at a time — a model reading somebody's caption is a rough
/// process, and nothing reaches the trip on its say-so.
type Found = {
  title: string;
  note: string | null;
  match: SearchResult | null;
  keep: boolean;
};

export default function AddFromLink({
  trip,
  days,
  activeDay,
  region,
  onAdded,
}: {
  trip: TripDTO;
  days: number;
  activeDay: number;
  region: string[] | string | null;
  onAdded: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [day, setDay] = useState(activeDay);
  const [rows, setRows] = useState<Found[] | null>(null);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function check(text: string) {
    const parsed = parseItinerary(text);
    if (parsed.length === 0) {
      setError("Nothing in that caption looked like a place.");
      return;
    }

    setBusy(true);
    setError(null);
    setProgress({ done: 0, total: parsed.length });

    // One at a time, because the geocoders behind this allow about a request a
    // second — and the progress is worth seeing anyway.
    const found: Found[] = [];
    for (const [i, entry] of parsed.entries()) {
      let match: SearchResult | null = null;
      try {
        const hits = await searchPlaces(entry.title, "full", region);
        match = hits[0] ?? null;
      } catch {
        // A lookup that failed reads the same as one that found nothing: the
        // row stays, unmatched, for somebody to decide about.
      }
      found.push({ title: entry.title, note: entry.note, match, keep: match !== null });
      setProgress({ done: i + 1, total: parsed.length });
      setRows([...found]);
    }
    setBusy(false);
  }

  async function add() {
    const keeping = (rows ?? []).filter((r) => r.keep && r.match);
    if (keeping.length === 0) return;

    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/trips/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tripId: trip.id,
          // A trip being planned collects places you want to go, not ones you
          // have been to.
          markVisited: false,
          entries: keeping.map((r) => ({
            dayIndex: day,
            title: r.title,
            startTime: null,
            notes: r.note,
            category: r.match!.category,
            place: {
              name: r.match!.name,
              lat: r.match!.lat,
              lng: r.match!.lng,
              address: r.match!.address,
              city: r.match!.city,
              country: r.match!.country,
              countryCode: r.match!.countryCode,
            },
          })),
        }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Could not add those");

      setRows(null);
      setOpen(false);
      onAdded();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not add those");
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        className="self-start text-xs text-muted hover:underline"
        onClick={() => {
          setDay(activeDay);
          setOpen(true);
        }}
      >
        + Add places from TikTok
      </button>
    );
  }

  const keeping = (rows ?? []).filter((r) => r.keep && r.match).length;

  return (
    <div className="card space-y-3 p-3">
      <div className="flex items-start justify-between gap-2">
        <h2 className="text-sm font-semibold">Add places from TikTok</h2>
        <button
          type="button"
          className="rounded px-1.5 text-muted hover:bg-foreground/5"
          onClick={() => {
            setOpen(false);
            setRows(null);
          }}
        >
          ✕
        </button>
      </div>

      <label className="block text-xs text-muted">
        Which day
        <select
          className="input mt-1"
          value={day}
          onChange={(e) => setDay(Number(e.target.value))}
        >
          {Array.from({ length: days }, (_, i) => {
            const date = dateForDay(trip, i);
            return (
              <option key={i} value={i}>
                Day {i + 1}
                {date ? ` — ${formatDay(date)}` : ""}
              </option>
            );
          })}
        </select>
      </label>

      <ImportLink startOpen busy={busy} onRead={({ text }) => void check(text)} />

      {busy && progress.total > 0 && (
        <p className="text-xs text-muted">
          Checking place {progress.done} of {progress.total} against the map…
        </p>
      )}
      {error && <p className="text-xs text-red-600">{error}</p>}

      {rows && rows.length > 0 && (
        <>
          <ul className="space-y-1.5">
            {rows.map((row, i) => (
              <li key={`${row.title}-${i}`}>
                <button
                  type="button"
                  disabled={!row.match}
                  className={`flex w-full items-start gap-2 rounded-lg border p-2 text-left ${
                    row.keep && row.match ? "border-accent" : "border-line"
                  } ${row.match ? "" : "opacity-55"}`}
                  onClick={() =>
                    setRows((all) =>
                      all!.map((r, j) => (i === j ? { ...r, keep: !r.keep } : r)),
                    )
                  }
                >
                  <span aria-hidden>{row.match ? (row.keep ? "☑️" : "⬜️") : "⚠️"}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm">{row.title}</span>
                    <span className="block truncate text-xs text-muted">
                      {row.match
                        ? (row.match.address ?? row.match.city ?? row.match.name)
                        : "Not found on the map"}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>

          <button
            type="button"
            className="btn btn-primary text-xs"
            disabled={busy || keeping === 0}
            onClick={add}
          >
            Add {keeping} to day {day + 1}
          </button>
        </>
      )}
    </div>
  );
}
