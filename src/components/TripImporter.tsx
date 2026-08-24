"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { CATEGORIES, category as categoryOf } from "@/lib/taxonomy";
import { parseItinerary, parsedDayCount, type ParsedEntry } from "@/lib/itinerary-parser";
import type { SearchResult } from "@/lib/types";

const PLACEHOLDER = `Day 1: Zürich
- Lindenhof
09:00 Grossmünster — climb the tower

Day 2
Lauterbrunnen
Trümmelbach Falls - loud, bring a jacket

Day 3: Jungfraujoch
Kleine Scheidegg`;

type Row = ParsedEntry & {
  /// Geocoder matches, best first. Empty once lookup has failed or found nothing.
  candidates: SearchResult[];
  /// Index into candidates, or -1 for "no map pin".
  chosen: number;
  /// The geocoder's guess is often "other"; this is what actually gets saved.
  category: string;
  state: "waiting" | "looking" | "done";
};

export default function TripImporter() {
  const router = useRouter();

  const [title, setTitle] = useState("");
  const [region, setRegion] = useState("");
  const [startDate, setStartDate] = useState("");
  const [markVisited, setMarkVisited] = useState(true);
  const [text, setText] = useState("");

  const [rows, setRows] = useState<Row[] | null>(null);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const preview = useMemo(() => parseItinerary(text), [text]);
  const dayCount = parsedDayCount(preview);

  /// Looks each entry up one at a time. The geocoder allows roughly one
  /// request a second and the server queues to enforce that, so this is
  /// deliberately sequential with visible progress rather than a burst.
  async function resolve() {
    const parsed = parseItinerary(text);
    if (parsed.length === 0) {
      setError("Nothing to import — paste an itinerary first.");
      return;
    }

    setError(null);
    setBusy(true);
    setProgress({ done: 0, total: parsed.length });

    const initial: Row[] = parsed.map((entry) => ({
      ...entry,
      candidates: [],
      chosen: -1,
      category: "other",
      state: "waiting",
    }));
    setRows(initial);

    const hint = region.trim();
    const working = [...initial];

    for (let i = 0; i < working.length; i += 1) {
      working[i] = { ...working[i]!, state: "looking" };
      setRows([...working]);

      const query = hint ? `${working[i]!.title}, ${hint}` : working[i]!.title;
      try {
        const res = await fetch(`/api/geocode?q=${encodeURIComponent(query)}`);
        const body = await res.json();
        const candidates: SearchResult[] = body.results ?? [];
        working[i] = {
          ...working[i]!,
          candidates,
          chosen: candidates.length > 0 ? 0 : -1,
          category: candidates[0]?.category ?? "other",
          state: "done",
        };
      } catch {
        working[i] = { ...working[i]!, candidates: [], chosen: -1, state: "done" };
      }

      setRows([...working]);
      setProgress({ done: i + 1, total: working.length });
    }

    setBusy(false);
  }

  async function create() {
    if (!rows) return;
    setBusy(true);
    setError(null);

    const days = parsedDayCount(rows);
    // A trip you've already taken has a known length, so the end date follows
    // from the start date and the number of days rather than being asked for.
    const endDate = startDate
      ? new Date(Date.parse(startDate) + (days - 1) * 86400000).toISOString().slice(0, 10)
      : null;

    const res = await fetch("/api/trips/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        trip: {
          title: title.trim(),
          destination: region.trim() || null,
          startDate: startDate || null,
          endDate,
        },
        markVisited,
        entries: rows.map((row) => {
          const match = row.chosen >= 0 ? row.candidates[row.chosen] : null;
          return {
            dayIndex: row.dayIndex,
            title: row.title,
            startTime: row.startTime,
            notes: row.note,
            category: row.category,
            place: match
              ? {
                  name: row.title,
                  lat: match.lat,
                  lng: match.lng,
                  address: match.address,
                  city: match.city,
                  country: match.country,
                  countryCode: match.countryCode,
                }
              : null,
          };
        }),
      }),
    });

    const body = await res.json().catch(() => ({}));
    setBusy(false);

    if (!res.ok) {
      setError(body.error ?? "Could not create that trip");
      return;
    }
    router.push(`/trips/${body.tripId}`);
    router.refresh();
  }

  const matched = rows?.filter((r) => r.chosen >= 0).length ?? 0;

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="text-xl font-semibold">Add a trip you&apos;ve taken</h1>
      <p className="mt-1 text-sm text-muted">
        Paste where you went, roughly by day. Every place is looked up on the map
        and saved to your places, so you only type names.
      </p>
      <Link
        href="/trips/import"
        className="mt-1 inline-block text-xs text-muted hover:underline"
      >
        Rather pick dates and click through the days? Use the guided version
      </Link>

      <div className="mt-6 space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-xs text-muted">
            Trip name
            <input
              className="input mt-1"
              placeholder="Switzerland"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </label>
          <label className="text-xs text-muted">
            Country or region
            <input
              className="input mt-1"
              placeholder="Switzerland"
              value={region}
              onChange={(e) => setRegion(e.target.value)}
            />
            <span className="mt-1 block text-xs text-muted">
              Added to every search, so “Grindelwald” finds the right one.
            </span>
          </label>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-xs text-muted">
            First day (optional)
            <input
              type="date"
              className="input mt-1"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </label>
          <label className="flex items-end gap-2 text-xs text-muted">
            <input
              type="checkbox"
              checked={markVisited}
              onChange={(e) => setMarkVisited(e.target.checked)}
              className="mb-1.5 size-4"
            />
            <span className="mb-1">Mark every place as “Been there”</span>
          </label>
        </div>

        <label className="block text-xs text-muted">
          Itinerary
          <textarea
            className="input mt-1 min-h-56 resize-y font-mono text-xs"
            placeholder={PLACEHOLDER}
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
        </label>

        <p className="text-xs text-muted">
          One place per line. <code>Day 2</code> starts a new day, a leading{" "}
          <code>09:00</code> sets a time, and anything after <code> — </code> becomes a note.
          {preview.length > 0 && (
            <>
              {" "}
              <span className="text-foreground">
                {preview.length} {preview.length === 1 ? "entry" : "entries"} across{" "}
                {dayCount} {dayCount === 1 ? "day" : "days"}.
              </span>
            </>
          )}
        </p>

        {error && <p className="text-xs text-red-500">{error}</p>}

        <button
          type="button"
          className="btn btn-primary"
          disabled={busy || preview.length === 0}
          onClick={resolve}
        >
          {busy && progress.total > 0
            ? `Looking up ${progress.done} of ${progress.total}…`
            : "Find these places"}
        </button>
        {busy && (
          <p className="text-xs text-muted">
            One lookup a second — that&apos;s the free map service&apos;s limit, not slowness.
          </p>
        )}
      </div>

      {rows && (
        <div className="mt-8">
          <h2 className="text-sm font-semibold">
            Check the matches
            <span className="ml-2 text-xs font-normal text-muted">
              {matched} of {rows.length} found
            </span>
          </h2>
          <p className="mt-1 text-xs text-muted">
            Pick a different match where it guessed wrong. “No map pin” keeps the
            entry on the day without adding it to your places.
          </p>

          <ul className="mt-3 space-y-2">
            {rows.map((row, index) => {
              const match = row.chosen >= 0 ? row.candidates[row.chosen] : null;
              const meta = categoryOf(match?.category ?? "other");
              return (
                <li key={index} className="card p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="chip">Day {row.dayIndex + 1}</span>
                    {row.startTime && (
                      <span className="text-xs text-muted tabular-nums">{row.startTime}</span>
                    )}
                    <span className="text-sm font-medium">{row.title}</span>
                    {row.state === "looking" && (
                      <span className="text-xs text-muted">looking up…</span>
                    )}
                    {row.state === "done" && !match && (
                      <span className="text-xs text-amber-600 dark:text-amber-400">
                        not found — will be added without a pin
                      </span>
                    )}
                  </div>

                  {row.note && (
                    <p className="mt-1 text-xs text-muted">{row.note}</p>
                  )}

                  {row.candidates.length > 0 && (
                    <div className="mt-2 flex items-center gap-2">
                      <span aria-hidden>{meta.icon}</span>
                      <select
                        aria-label={`Match for ${row.title}`}
                        className="input text-xs"
                        value={row.chosen}
                        onChange={(e) => {
                          const next = Number(e.target.value);
                          setRows((prev) =>
                            prev!.map((r, i) =>
                              i === index
                                ? {
                                    ...r,
                                    chosen: next,
                                    category:
                                      next >= 0 ? (r.candidates[next]?.category ?? r.category) : r.category,
                                  }
                                : r,
                            ),
                          );
                        }}
                      >
                        {row.candidates.map((c, i) => (
                          <option key={c.id} value={i}>
                            {c.context}
                          </option>
                        ))}
                        <option value={-1}>No map pin</option>
                      </select>
                    </div>
                  )}

                  <div className="mt-2 flex items-center gap-2">
                    <label className="text-xs text-muted" htmlFor={`cat-${index}`}>
                      Category
                    </label>
                    <select
                      id={`cat-${index}`}
                      className="input w-40 text-xs"
                      value={row.category}
                      onChange={(e) =>
                        setRows((prev) =>
                          prev!.map((r, i) =>
                            i === index ? { ...r, category: e.target.value } : r,
                          ),
                        )
                      }
                    >
                      {CATEGORIES.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.icon} {c.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </li>
              );
            })}
          </ul>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <button
              type="button"
              className="btn btn-primary"
              disabled={busy || title.trim().length === 0}
              onClick={create}
            >
              {busy ? "Creating…" : `Create trip with ${rows.length} stops`}
            </button>
            {title.trim().length === 0 && (
              <span className="text-xs text-amber-600 dark:text-amber-400">
                Give the trip a name first.
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
