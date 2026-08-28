"use client";

import { usePlaceSearch } from "@/lib/use-place-search";
import { searchPlaces } from "@/lib/search-places";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import MapCanvas, { type MapPin } from "@/components/MapCanvas";
import { CATEGORIES, category as categoryOf } from "@/lib/taxonomy";
import { formatDay } from "@/lib/trips";
import type { SearchResult } from "@/lib/types";

const DAY_MS = 86400000;

type Stop = {
  key: string;
  dayIndex: number;
  title: string;
  category: string;
  startTime: string | null;
  notes: string | null;
  /// Null for things that happened but aren't a place you can look up —
  /// "dinner at the place by the lake", "drove the Furka Pass".
  place: SearchResult | null;
};

/// Builds a trip by picking real dates first, then filling each day by
/// searching and clicking. Nothing to type but the name of a place, and every
/// click lands on the map immediately.
export default function TripBuilder() {
  const router = useRouter();

  const [title, setTitle] = useState("");
  const [destination, setDestination] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [markVisited, setMarkVisited] = useState(true);

  const [activeDay, setActiveDay] = useState(0);
  const [stops, setStops] = useState<Stop[]>([]);
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dropMode, setDropMode] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  // The days come from the dates, so there is never a "Day 3" to type.
  const days = useMemo(() => {
    if (!startDate) return [];
    const start = Date.parse(startDate);
    const end = endDate ? Date.parse(endDate) : start;
    if (Number.isNaN(start) || Number.isNaN(end) || end < start) return [];
    const count = Math.round((end - start) / DAY_MS) + 1;
    return Array.from({ length: Math.min(count, 60) }, (_, i) => new Date(start + i * DAY_MS));
  }, [startDate, endDate]);

  const datesInvalid = Boolean(startDate && endDate && Date.parse(endDate) < Date.parse(startDate));
  const ready = days.length > 0;

  // Shortening the trip can leave the selected day past the end, so the day
  // actually in use is derived rather than stored — no correcting effect.
  const day = days.length > 0 ? Math.min(activeDay, days.length - 1) : 0;

  // --- live search, as you type --------------------------------------------
  const trimmed = query.trim();
  const { results, searching } = usePlaceSearch(trimmed, (q, mode) =>
    searchPlaces(q, mode, destination.trim()),
  );

  const dayStops = useMemo(
    () => stops.filter((s) => s.dayIndex === day),
    [stops, day],
  );

  const pins = useMemo<MapPin[]>(() => {
    const numbers = new Map(dayStops.map((s, i) => [s.key, i + 1]));
    return stops.filter((s) => s.place !== null).map((s) => {
      const meta = categoryOf(s.category);
      const badge = numbers.get(s.key);
      return {
        id: s.key,
        lat: s.place!.lat,
        lng: s.place!.lng,
        color: badge ? "#0F2D4A" : meta.color,
        icon: meta.icon,
        badge: badge ? String(badge) : null,
        muted: !badge,
      };
    });
  }, [stops, dayStops]);

  function addStop(
    title: string,
    place: SearchResult | null,
    category = place?.category ?? "other",
  ) {
    setStops((prev) => [
      ...prev,
      {
        key: `stop-${Date.now()}-${prev.length}`,
        dayIndex: day,
        title,
        category,
        startTime: null,
        notes: null,
        place,
      },
    ]);
    setQuery("");
  }

  /// Clicking the map adds whatever is at that point. The reverse lookup
  /// usually names it; when it can't, the stop still lands and you type the
  /// name yourself.
  async function dropPin(lat: number, lng: number) {
    setDropMode(false);
    setNotice("Looking up that spot…");

    try {
      const res = await fetch(`/api/geocode/reverse?lat=${lat}&lng=${lng}`);
      const body = await res.json();
      const r = body.result;
      addStop(r.name || "", {
        id: `pin-${Date.now()}`,
        name: r.name || "Dropped pin",
        lat,
        lng,
        address: r.address ?? null,
        city: r.city ?? null,
        country: r.country ?? null,
        countryCode: r.countryCode ?? null,
        category: r.category ?? "other",
        context: r.address ?? "",
      });
    } catch {
      addStop("", {
        id: `pin-${Date.now()}`,
        name: "Dropped pin",
        lat,
        lng,
        address: null,
        city: null,
        country: null,
        countryCode: null,
        category: "other",
        context: "",
      });
    } finally {
      setNotice(null);
    }
  }

  const unnamed = stops.filter((s) => s.title.trim().length === 0).length;

  function updateStop(key: string, changes: Partial<Stop>) {
    setStops((prev) => prev.map((s) => (s.key === key ? { ...s, ...changes } : s)));
  }

  async function create() {
    setBusy(true);
    setError(null);

    const res = await fetch("/api/trips/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        trip: {
          title: title.trim(),
          destination: destination.trim() || null,
          startDate: startDate || null,
          endDate: endDate || startDate || null,
        },
        markVisited,
        entries: stops.map((s) => ({
          dayIndex: s.dayIndex,
          title: s.title,
          startTime: s.startTime,
          notes: s.notes,
          category: s.category,
          place: s.place
            ? {
                name: s.title,
                lat: s.place.lat,
                lng: s.place.lng,
                address: s.place.address,
                city: s.place.city,
                country: s.place.country,
                countryCode: s.place.countryCode,
              }
            : null,
        })),
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

  return (
    <div className="flex h-full flex-col lg:flex-row">
      <aside className="flex w-full shrink-0 flex-col gap-4 overflow-y-auto border-b border-line p-4 lg:h-full lg:w-[30rem] lg:border-r lg:border-b-0">
        <div>
          <h1 className="text-lg font-semibold">Add a trip you&apos;ve taken</h1>
          <p className="mt-1 text-sm text-muted">
            Set the dates, then click through the days adding what you did.
          </p>
          <Link
            href="/trips/import/paste"
            className="mt-1 inline-block text-xs text-muted hover:underline"
          >
            Already have it written down? Paste a list instead
          </Link>
        </div>

        {/* --- step 1: when --- */}
        <div className="space-y-3">
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
              Where
              <input
                className="input mt-1"
                placeholder="Switzerland"
                value={destination}
                onChange={(e) => setDestination(e.target.value)}
              />
            </label>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-xs text-muted">
              Went out
              <input
                type="date"
                className="input mt-1"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </label>
            <label className="text-xs text-muted">
              Came back
              <input
                type="date"
                className="input mt-1"
                value={endDate}
                min={startDate || undefined}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </label>
          </div>

          {datesInvalid && (
            <p className="text-xs text-red-500">
              The return date is before you left.
            </p>
          )}
        </div>

        {!ready ? (
          <p className="card p-3 text-xs text-muted">
            Pick the dates and the days will appear here, one per day of the trip.
          </p>
        ) : (
          <>
            {/* --- step 2: which day --- */}
            <div>
              <p className="mb-1.5 text-xs tracking-wide text-muted uppercase">
                {days.length} {days.length === 1 ? "day" : "days"} — pick one
              </p>
              <div className="flex flex-wrap gap-1.5">
                {days.map((date, i) => {
                  const count = stops.filter((s) => s.dayIndex === i).length;
                  return (
                    <button
                      key={i}
                      type="button"
                      className={`chip ${day === i ? "is-on" : ""}`}
                      onClick={() => setActiveDay(i)}
                    >
                      {formatDay(date)}
                      {count > 0 && <span className="text-muted">{count}</span>}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* --- step 3: what you did --- */}
            <div>
              <label className="text-xs text-muted" htmlFor="stop-search">
                What did you do on {formatDay(days[day] ?? days[0]!)}?
              </label>
              <input
                id="stop-search"
                className="input mt-1"
                placeholder="Start typing a place — Jungfraujoch, a restaurant, a hotel…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />

              <div className="mt-2 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  className={`chip ${dropMode ? "is-on" : ""}`}
                  onClick={() => setDropMode((v) => !v)}
                >
                  📌 {dropMode ? "Click the map…" : "Drop a pin instead"}
                </button>
                {trimmed.length > 0 && (
                  <button
                    type="button"
                    className="chip"
                    onClick={() => addStop(trimmed, null)}
                  >
                    ✏️ Add “{trimmed}” with no pin
                  </button>
                )}
                {notice && <span className="text-xs text-muted">{notice}</span>}
              </div>

              {trimmed.length >= 3 && (
                <ul className="mt-2 divide-y divide-line overflow-hidden rounded-lg border border-line">
                  {searching && (
                    <li className="px-2.5 py-2 text-xs text-muted">Searching…</li>
                  )}
                  {!searching && results.length === 0 && (
                    <li className="px-2.5 py-2">
                      <p className="text-xs text-muted">
                        Nothing found. Try the local spelling — Aareschlucht rather
                        than Aare Gorge — or add it anyway.
                      </p>
                      <button
                        type="button"
                        className="btn btn-ghost mt-2 w-full justify-center"
                        onClick={() => addStop(trimmed, null)}
                      >
                        Add “{trimmed}” without a map pin
                      </button>
                    </li>
                  )}
                  {results.map((r) => (
                    <li key={r.id}>
                      <button
                        type="button"
                        className="flex w-full items-center gap-2.5 px-2.5 py-2 text-left hover:bg-foreground/5"
                        onClick={() => addStop(r.name, r)}
                      >
                        <span aria-hidden>{categoryOf(r.category).icon}</span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm">{r.name}</span>
                          <span className="block truncate text-xs text-muted">
                            {r.context}
                          </span>
                        </span>
                        <span className="text-xs text-accent-text">Add</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* --- what's on this day --- */}
            <div>
              <h2 className="text-sm font-semibold">
                {formatDay(days[day] ?? days[0]!)}
                <span className="ml-2 text-xs font-normal text-muted">
                  {dayStops.length} {dayStops.length === 1 ? "stop" : "stops"}
                </span>
              </h2>

              {dayStops.length === 0 ? (
                <p className="mt-2 text-xs text-muted">
                  Nothing yet — search above and click a result to add it.
                </p>
              ) : (
                <ol className="mt-2 space-y-2">
                  {dayStops.map((stop, index) => (
                    <li key={stop.key} className="card p-2.5">
                      <div className="flex items-start gap-2.5">
                        <span
                          aria-hidden
                          className="grid size-7 shrink-0 place-items-center rounded-full bg-accent text-xs font-semibold text-white"
                        >
                          {index + 1}
                        </span>
                        <div className="min-w-0 flex-1">
                          <input
                            className="input text-sm font-medium"
                            aria-label="Name of this stop"
                            placeholder="What was it called?"
                            value={stop.title}
                            onChange={(e) => updateStop(stop.key, { title: e.target.value })}
                          />
                          <p className="mt-1 truncate text-xs text-muted">
                            {stop.place
                              ? [stop.place.city, stop.place.country].filter(Boolean).join(", ") ||
                                `${stop.place.lat.toFixed(4)}, ${stop.place.lng.toFixed(4)}`
                              : "No map pin — it will sit on the day without a location"}
                          </p>
                        </div>
                        <button
                          type="button"
                          className="shrink-0 rounded px-1.5 py-0.5 text-xs text-muted hover:bg-foreground/5"
                          onClick={() => setStops((p) => p.filter((s) => s.key !== stop.key))}
                        >
                          Remove
                        </button>
                      </div>

                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <select
                          aria-label={`Category for ${stop.title}`}
                          className="input w-36 text-xs"
                          value={stop.category}
                          onChange={(e) => updateStop(stop.key, { category: e.target.value })}
                        >
                          {CATEGORIES.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.icon} {c.label}
                            </option>
                          ))}
                        </select>
                        <input
                          type="time"
                          aria-label={`Time for ${stop.title}`}
                          className="input w-28 text-xs"
                          value={stop.startTime ?? ""}
                          onChange={(e) =>
                            updateStop(stop.key, { startTime: e.target.value || null })
                          }
                        />
                        <select
                          aria-label={`Move ${stop.title} to another day`}
                          className="input w-32 text-xs"
                          value={stop.dayIndex}
                          onChange={(e) =>
                            updateStop(stop.key, { dayIndex: Number(e.target.value) })
                          }
                        >
                          {days.map((d, i) => (
                            <option key={i} value={i}>
                              {formatDay(d, { weekday: undefined })}
                            </option>
                          ))}
                        </select>
                      </div>

                      <input
                        className="input mt-2 text-xs"
                        aria-label={`Notes for ${stop.title || "this stop"}`}
                        placeholder="Notes — what you ate, who you were with, what to remember…"
                        value={stop.notes ?? ""}
                        onChange={(e) =>
                          updateStop(stop.key, { notes: e.target.value || null })
                        }
                      />
                    </li>
                  ))}
                </ol>
              )}
            </div>

            <label className="flex items-center gap-2 text-xs text-muted">
              <input
                type="checkbox"
                checked={markVisited}
                onChange={(e) => setMarkVisited(e.target.checked)}
                className="size-4"
              />
              Mark every place as “Been there”
            </label>

            {error && <p className="text-xs text-red-500">{error}</p>}

            <button
              type="button"
              className="btn btn-primary"
              disabled={
                busy || title.trim().length === 0 || stops.length === 0 || unnamed > 0
              }
              onClick={create}
            >
              {busy
                ? "Creating…"
                : `Create trip with ${stops.length} ${stops.length === 1 ? "stop" : "stops"}`}
            </button>
            {title.trim().length === 0 && stops.length > 0 && (
              <p className="text-xs text-amber-600 dark:text-amber-400">
                Give the trip a name first.
              </p>
            )}
            {unnamed > 0 && (
              <p className="text-xs text-amber-600 dark:text-amber-400">
                {unnamed === 1 ? "One stop still needs" : `${unnamed} stops still need`} a
                name.
              </p>
            )}
          </>
        )}
      </aside>

      <div className="relative min-h-[45vh] flex-1 lg:min-h-0">
        <MapCanvas
          pins={pins}
          fitToken={`builder-${stops.length}-${day}`}
          onMapClick={ready && dropMode ? dropPin : undefined}
        />
        {dropMode && (
          <div className="pointer-events-none absolute inset-x-0 top-3 flex justify-center">
            <p className="card px-3 py-1.5 text-xs shadow-lg">
              Click anywhere on the map to add it to {formatDay(days[day] ?? days[0]!)}
            </p>
          </div>
        )}
        {!dropMode && stops.length === 0 && (
          <div className="pointer-events-none absolute inset-x-0 top-3 flex justify-center">
            <p className="card px-3 py-1.5 text-xs shadow-lg">
              Places appear here as you add them
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
