"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import MapCanvas, { type MapPin } from "@/components/MapCanvas";
import EmojiField from "@/components/EmojiField";
import ShareTrip from "@/components/ShareTrip";
import TripPeople from "@/components/TripPeople";
import TripSettings from "@/components/TripSettings";
import { CATEGORIES, category as categoryOf, placeIcon, stopIcon } from "@/lib/taxonomy";
import { dateForDay, dayCount, formatDay, formatRange } from "@/lib/trips";
import { directionsUrl } from "@/lib/directions";
import type { ItineraryItemDTO, PlaceDTO, SearchResult, TripDTO } from "@/lib/types";
import type { TripRole } from "@/lib/trip-access";

export default function TripPlanner({
  trip: initialTrip,
  initialItems,
  places,
  role,
  ownerLabel,
}: {
  trip: TripDTO;
  initialItems: ItineraryItemDTO[];
  places: PlaceDTO[];
  role: TripRole;
  ownerLabel: string;
}) {
  // The trip is editable in place (title, dates, colour), so it lives in state
  // rather than being read straight from props.
  const [trip, setTrip] = useState(initialTrip);
  const [items, setItems] = useState(initialItems);
  const [activeDay, setActiveDay] = useState(0);
  const [extraDays, setExtraDays] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [dropMode, setDropMode] = useState(false);
  // Which stop's emoji picker is open. Separate from selectedId so changing an
  // emoji doesn't also expand the notes panel.
  const [emojiFor, setEmojiFor] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  // Places saved from inside the trip go into the library too, so they are
  // available on the map and on every future trip.
  const [library, setLibrary] = useState(places);

  const days = dayCount(trip, items) + extraDays;
  const dayItems = useMemo(
    () =>
      items
        .filter((i) => i.dayIndex === activeDay)
        .sort((a, b) => a.position - b.position),
    [items, activeDay],
  );

  const pins = useMemo<MapPin[]>(() => {
    const onThisDay = new Map(dayItems.map((item, index) => [item.id, index + 1]));

    return items
      .filter((item) => item.place)
      .map((item) => {
        const meta = categoryOf(item.category);
        const badge = onThisDay.get(item.id);
        return {
          id: item.id,
          lat: item.place!.lat,
          lng: item.place!.lng,
          color: badge ? trip.color : meta.color,
          icon: stopIcon(item),
          badge: badge ? String(badge) : null,
          muted: !badge,
        };
      });
  }, [items, dayItems, trip.color]);

  const route = useMemo<[number, number][]>(
    () =>
      dayItems
        .filter((i) => i.place)
        .map((i) => [i.place!.lng, i.place!.lat] as [number, number]),
    [dayItems],
  );

  async function mutate<T>(
    run: () => Promise<Response>,
    apply: (body: T) => void,
    failure: string,
  ) {
    setBusy(true);
    setError(null);
    const res = await run();
    const body = await res.json().catch(() => ({}));
    setBusy(false);

    if (!res.ok) {
      setError(body.error ?? failure);
      return false;
    }
    apply(body as T);
    return true;
  }

  function addItem(payload: {
    title: string;
    placeId?: string | null;
    category?: string;
  }) {
    return mutate<{ item: ItineraryItemDTO }>(
      () =>
        fetch(`/api/trips/${trip.id}/items`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...payload, dayIndex: activeDay }),
        }),
      (body) => setItems((prev) => [...prev, body.item]),
      "Could not add that stop",
    );
  }

  /// Saves somewhere new to the user's places and adds it to the current day.
  async function addNewPlace(input: {
    name: string;
    lat: number;
    lng: number;
    address: string | null;
    city: string | null;
    country: string | null;
    countryCode: string | null;
    category: string;
  }) {
    setBusy(true);
    setError(null);

    // A trip that has already finished is a log, so anything added to it has
    // been visited; a trip still ahead is a plan, so it goes on the wishlist.
    // Read at click time — the clock is not something to consult during render.
    const alreadyHappened = trip.endDate ? Date.parse(trip.endDate) < Date.now() : false;

    const res = await fetch("/api/places", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: input.name,
        category: input.category,
        status: alreadyHappened ? "visited" : "wishlist",
        lat: input.lat,
        lng: input.lng,
        address: input.address,
        city: input.city,
        country: input.country,
        countryCode: input.countryCode,
      }),
    });
    const body = await res.json().catch(() => ({}));

    if (!res.ok) {
      setBusy(false);
      setError(body.error ?? "Could not save that place");
      return;
    }

    const place: PlaceDTO = body.place;
    setLibrary((prev) => [place, ...prev]);
    setBusy(false);

    await addItem({ title: place.name, placeId: place.id, category: place.category });
  }

  async function dropPin(lat: number, lng: number) {
    setDropMode(false);
    setNotice("Looking up that spot…");

    try {
      const res = await fetch(`/api/geocode/reverse?lat=${lat}&lng=${lng}`);
      const body = await res.json();
      const r = body.result;
      await addNewPlace({
        name: r.name || `Pin at ${lat.toFixed(4)}, ${lng.toFixed(4)}`,
        lat,
        lng,
        address: r.address ?? null,
        city: r.city ?? null,
        country: r.country ?? null,
        countryCode: r.countryCode ?? null,
        category: r.category ?? "other",
      });
    } catch {
      await addNewPlace({
        name: `Pin at ${lat.toFixed(4)}, ${lng.toFixed(4)}`,
        lat,
        lng,
        address: null,
        city: null,
        country: null,
        countryCode: null,
        category: "other",
      });
    } finally {
      setNotice(null);
    }
  }

  function patchItem(id: string, changes: Partial<ItineraryItemDTO>) {
    return mutate<{ item: ItineraryItemDTO }>(
      () =>
        fetch(`/api/items/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(changes),
        }),
      (body) =>
        setItems((prev) => prev.map((i) => (i.id === body.item.id ? body.item : i))),
      "Could not update that stop",
    );
  }

  async function removeItem(id: string) {
    setBusy(true);
    const res = await fetch(`/api/items/${id}`, { method: "DELETE" });
    setBusy(false);
    if (res.ok) setItems((prev) => prev.filter((i) => i.id !== id));
    else setError("Could not remove that stop");
  }

  /// Reordering is a straight swap of the two neighbours' positions.
  async function move(index: number, direction: -1 | 1) {
    const a = dayItems[index];
    const b = dayItems[index + direction];
    if (!a || !b) return;

    await patchItem(a.id, { position: b.position });
    await patchItem(b.id, { position: a.position });
  }

  const dayDate = dateForDay(trip, activeDay);

  return (
    <div className="flex h-full flex-col lg:flex-row">
      <aside className="flex w-full shrink-0 flex-col gap-4 overflow-y-auto border-b border-line p-4 lg:h-full lg:w-[26rem] lg:border-r lg:border-b-0">
        <div>
          <Link href="/trips" className="text-xs text-muted hover:underline">
            ← All trips
          </Link>
          <h1 className="mt-1 flex items-center gap-2 text-lg font-semibold">
            <span
              aria-hidden
              className="size-3 rounded-full"
              style={{ background: trip.color }}
            />
            {trip.title}
          </h1>
          <p className="text-xs text-muted">
            {[trip.destination, formatRange(trip)].filter(Boolean).join(" · ")}
          </p>
        </div>

        {/* Renaming, sharing and deleting stay with the owner; an editor gets
            the itinerary and nothing else. */}
        {role === "owner" && (
          <>
            <TripSettings trip={trip} onUpdated={setTrip} />
            <ShareTrip tripId={trip.id} />
          </>
        )}

        <TripPeople tripId={trip.id} role={role} ownerLabel={ownerLabel} />

        <div className="flex flex-wrap gap-1.5">
          {Array.from({ length: days }, (_, i) => {
            const date = dateForDay(trip, i);
            return (
              <button
                key={i}
                type="button"
                className={`chip ${activeDay === i ? "is-on" : ""}`}
                onClick={() => setActiveDay(i)}
              >
                {date ? formatDay(date, { weekday: "short", month: undefined, day: undefined }) : `Day ${i + 1}`}
                <span className="text-muted">{i + 1}</span>
              </button>
            );
          })}
          {!trip.endDate && (
            <button
              type="button"
              className="chip"
              onClick={() => {
                setExtraDays((n) => n + 1);
                setActiveDay(days);
              }}
            >
              ＋ Day
            </button>
          )}
        </div>

        <div>
          <h2 className="text-sm font-semibold">
            Day {activeDay + 1}
            {dayDate && (
              <span className="ml-2 text-xs font-normal text-muted">
                {formatDay(dayDate)}
              </span>
            )}
          </h2>

          {dayItems.length === 0 ? (
            <p className="mt-2 text-xs text-muted">
              Nothing planned for this day yet.
            </p>
          ) : (
            <ol className="mt-2 space-y-2">
              {dayItems.map((item, index) => {
                const meta = categoryOf(item.category);
                return (
                  <li
                    key={item.id}
                    className={`card p-2.5 ${selectedId === item.id ? "ring-2 ring-accent" : ""}`}
                  >
                    <div className="flex items-start gap-2.5">
                      <span
                        aria-hidden
                        className="grid size-7 shrink-0 place-items-center rounded-full text-xs font-semibold text-white"
                        style={{ background: trip.color }}
                      >
                        {index + 1}
                      </span>
                      <button
                        type="button"
                        aria-label={`Change the emoji for ${item.title}`}
                        title="Change emoji"
                        className={`grid size-7 shrink-0 place-items-center rounded-full border text-sm transition-colors ${
                          emojiFor === item.id
                            ? "border-accent bg-accent/10"
                            : "border-line hover:bg-foreground/5"
                        }`}
                        onClick={() =>
                          setEmojiFor((cur) => (cur === item.id ? null : item.id))
                        }
                      >
                        {stopIcon(item)}
                      </button>
                      <button
                        type="button"
                        className="min-w-0 flex-1 text-left"
                        onClick={() => setSelectedId(item.id)}
                      >
                        <p className="truncate text-sm font-medium">{item.title}</p>
                        <p className="truncate text-xs text-muted">
                          {meta.label}
                          {item.place?.city ? ` · ${item.place.city}` : ""}
                        </p>
                      </button>
                      <input
                        type="time"
                        aria-label="Start time"
                        className="input w-24 shrink-0 px-1.5 py-1 text-xs"
                        value={item.startTime ?? ""}
                        onChange={(e) =>
                          patchItem(item.id, { startTime: e.target.value || null })
                        }
                      />
                    </div>

                    <div className="mt-2 flex items-center gap-1 text-xs">
                      <button
                        type="button"
                        className="rounded px-1.5 py-0.5 text-muted hover:bg-foreground/5 disabled:opacity-30"
                        disabled={busy || index === 0}
                        onClick={() => move(index, -1)}
                        aria-label="Move earlier"
                      >
                        ▲
                      </button>
                      <button
                        type="button"
                        className="rounded px-1.5 py-0.5 text-muted hover:bg-foreground/5 disabled:opacity-30"
                        disabled={busy || index === dayItems.length - 1}
                        onClick={() => move(index, 1)}
                        aria-label="Move later"
                      >
                        ▼
                      </button>
                      <select
                        aria-label="Move to day"
                        className="ml-auto rounded border border-line bg-surface px-1.5 py-0.5 text-xs"
                        value={item.dayIndex}
                        onChange={(e) =>
                          patchItem(item.id, { dayIndex: Number(e.target.value) })
                        }
                      >
                        {Array.from({ length: days }, (_, i) => (
                          <option key={i} value={i}>
                            Day {i + 1}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        className="rounded px-1.5 py-0.5 text-muted hover:bg-foreground/5"
                        disabled={busy}
                        onClick={() => removeItem(item.id)}
                      >
                        Remove
                      </button>
                    </div>

                    {emojiFor === item.id && (
                      <div className="mt-2 border-t border-line pt-2">
                        <EmojiField
                          emoji={item.emoji}
                          category={item.category}
                          fallback={
                            item.place ? placeIcon(item.place) : categoryOf(item.category).icon
                          }
                          onChange={(emoji) => patchItem(item.id, { emoji })}
                        />
                        {item.place && (
                          <p className="mt-1.5 text-xs text-muted">
                            Changes this stop only. To change{" "}
                            <span className="font-medium">{item.place.name}</span>{" "}
                            everywhere, edit it on the map.
                          </p>
                        )}
                      </div>
                    )}

                    {selectedId === item.id && (
                      <div className="mt-2 space-y-1.5 border-t border-line pt-2">
                        <textarea
                          // Uncontrolled and saved on blur: no keystroke-by-keystroke
                          // requests, and `key` resets it when the stop changes.
                          key={item.id}
                          aria-label="Notes for this stop"
                          className="input min-h-14 resize-y text-xs"
                          placeholder="Notes — booking reference, what to order…"
                          defaultValue={item.notes ?? ""}
                          onBlur={(e) => {
                            const next = e.target.value.trim() || null;
                            if (next !== item.notes) patchItem(item.id, { notes: next });
                          }}
                        />
                        {item.place && (
                          <div className="flex flex-wrap items-center gap-3">
                            <Link
                              href={`/?place=${item.place.id}`}
                              className="text-xs text-accent hover:underline"
                            >
                              Open on the map →
                            </Link>
                            <a
                              href={directionsUrl({
                                lat: item.place.lat,
                                lng: item.place.lng,
                                name: item.place.name,
                              })}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-accent hover:underline"
                            >
                              Directions →
                            </a>
                            {/* Routing from the stop before it is the question you
                                actually have while standing at one. */}
                            {(() => {
                              const previous = dayItems[index - 1]?.place;
                              if (!previous) return null;
                              return (
                                <a
                                  href={directionsUrl(
                                    { lat: item.place!.lat, lng: item.place!.lng, name: item.place!.name },
                                    { lat: previous.lat, lng: previous.lng, name: previous.name },
                                  )}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-xs text-accent hover:underline"
                                >
                                  From {previous.name} →
                                </a>
                              );
                            })()}
                          </div>
                        )}
                      </div>
                    )}
                  </li>
                );
              })}
            </ol>
          )}
        </div>

        {error && <p className="text-xs text-red-500">{error}</p>}

        <AddStop
          places={library}
          usedPlaceIds={new Set(items.map((i) => i.placeId).filter(Boolean) as string[])}
          onAdd={addItem}
          onAddNew={addNewPlace}
          dropMode={dropMode}
          onToggleDrop={() => setDropMode((v) => !v)}
          notice={notice}
          busy={busy}
        />
      </aside>

      <div className="relative min-h-[55vh] flex-1 lg:min-h-0">
        <MapCanvas
          pins={pins}
          route={route}
          routeColor={trip.color}
          selectedId={selectedId}
          onSelect={setSelectedId}
          onMapClick={dropMode ? dropPin : undefined}
          fitToken={`trip-${trip.id}-${activeDay}`}
        />
        {dropMode && (
          <div className="pointer-events-none absolute inset-x-0 top-3 flex justify-center">
            <p className="card px-3 py-1.5 text-xs shadow-lg">
              Click the map to add a stop to day {activeDay + 1}
            </p>
          </div>
        )}
        {pins.length === 0 && (
          <div className="pointer-events-none absolute inset-x-0 top-3 flex justify-center">
            <p className="card px-3 py-1.5 text-xs shadow-lg">
              Add saved places to this trip to see them on the map
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

/// The add-a-stop control: pick one of your saved places, or type anything
/// that isn't a place ("Train to Porto") as a plain entry.
function AddStop({
  places,
  usedPlaceIds,
  onAdd,
  onAddNew,
  dropMode,
  onToggleDrop,
  notice,
  busy,
}: {
  places: PlaceDTO[];
  usedPlaceIds: Set<string>;
  onAdd: (payload: { title: string; placeId?: string | null; category?: string }) => Promise<boolean>;
  onAddNew: (input: {
    name: string;
    lat: number;
    lng: number;
    address: string | null;
    city: string | null;
    country: string | null;
    countryCode: string | null;
    category: string;
  }) => Promise<void>;
  dropMode: boolean;
  onToggleDrop: () => void;
  notice: string | null;
  busy: boolean;
}) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("other");
  // Searching the wider world from inside a trip, so adding somewhere new no
  // longer means a detour to the map and back.
  const [world, setWorld] = useState<{ q: string; items: SearchResult[] }>({
    q: "",
    items: [],
  });
  const requestId = useRef(0);
  const trimmed = query.trim();

  useEffect(() => {
    if (trimmed.length < 3) return;
    const id = ++requestId.current;

    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/geocode?q=${encodeURIComponent(trimmed)}`);
        const body = await res.json();
        if (id === requestId.current) setWorld({ q: trimmed, items: body.results ?? [] });
      } catch {
        if (id === requestId.current) setWorld({ q: trimmed, items: [] });
      }
    }, 450);

    return () => clearTimeout(timer);
  }, [trimmed]);

  const worldResults = world.q === trimmed ? world.items : [];

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    return places
      .filter((p) => !usedPlaceIds.has(p.id))
      .filter(
        (p) =>
          q.length === 0 ||
          [p.name, p.city, p.country].filter(Boolean).some((f) => f!.toLowerCase().includes(q)),
      )
      .slice(0, 6);
  }, [places, usedPlaceIds, query]);

  return (
    <div className="border-t border-line pt-4">
      <h2 className="mb-2 text-sm font-semibold">Add a stop</h2>

      <input
        className="input"
        placeholder="Search your places or anywhere in the world…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />

      <div className="mt-2 flex flex-wrap items-center gap-2">
        <button
          type="button"
          className={`chip ${dropMode ? "is-on" : ""}`}
          onClick={onToggleDrop}
        >
          📌 {dropMode ? "Click the map…" : "Drop a pin"}
        </button>
        {notice && <span className="text-xs text-muted">{notice}</span>}
      </div>

      {matches.length > 0 && (
        <ul className="mt-2 divide-y divide-line overflow-hidden rounded-lg border border-line">
          {matches.map((place) => {
            const meta = categoryOf(place.category);
            return (
              <li key={place.id}>
                <button
                  type="button"
                  disabled={busy}
                  className="flex w-full items-center gap-2.5 px-2.5 py-2 text-left hover:bg-foreground/5"
                  onClick={async () => {
                    const ok = await onAdd({
                      title: place.name,
                      placeId: place.id,
                      category: place.category,
                    });
                    if (ok) setQuery("");
                  }}
                >
                  <span aria-hidden>{placeIcon(place)}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm">{place.name}</span>
                    <span className="block truncate text-xs text-muted">
                      {[place.city, place.country].filter(Boolean).join(", ") || meta.label}
                    </span>
                  </span>
                  <span className="text-xs text-accent">Add</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {trimmed.length >= 3 && worldResults.length > 0 && (
        <>
          <p className="mt-3 mb-1 text-xs tracking-wide text-muted uppercase">
            Somewhere new
          </p>
          <ul className="divide-y divide-line overflow-hidden rounded-lg border border-line">
            {worldResults.map((r) => (
              <li key={r.id}>
                <button
                  type="button"
                  disabled={busy}
                  className="flex w-full items-center gap-2.5 px-2.5 py-2 text-left hover:bg-foreground/5"
                  onClick={async () => {
                    await onAddNew({
                      name: r.name,
                      lat: r.lat,
                      lng: r.lng,
                      address: r.address,
                      city: r.city,
                      country: r.country,
                      countryCode: r.countryCode,
                      category: r.category,
                    });
                    setQuery("");
                    setWorld({ q: "", items: [] });
                  }}
                >
                  <span aria-hidden>{categoryOf(r.category).icon}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm">{r.name}</span>
                    <span className="block truncate text-xs text-muted">{r.context}</span>
                  </span>
                  <span className="text-xs text-accent">Save &amp; add</span>
                </button>
              </li>
            ))}
          </ul>
        </>
      )}

      {query.trim().length > 0 && (
        <div className="mt-2 flex items-center gap-2">
          <select
            aria-label="Category for the new entry"
            className="input w-32 shrink-0"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            {CATEGORIES.map((c) => (
              <option key={c.id} value={c.id}>
                {c.icon} {c.label}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="btn btn-ghost"
            disabled={busy}
            onClick={async () => {
              const ok = await onAdd({ title: query.trim(), category, placeId: null });
              if (ok) setQuery("");
            }}
          >
            Add “{query.trim()}”
          </button>
        </div>
      )}

      {places.length === 0 && (
        <p className="mt-2 text-xs text-muted">
          You have no saved places yet —{" "}
          <Link href="/" className="text-accent underline">
            find some on the map
          </Link>
          .
        </p>
      )}
    </div>
  );
}
