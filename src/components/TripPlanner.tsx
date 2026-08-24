"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import MapCanvas, { type MapPin } from "@/components/MapCanvas";
import { CATEGORIES, category as categoryOf } from "@/lib/taxonomy";
import { dateForDay, dayCount, formatDay, formatRange } from "@/lib/trips";
import type { ItineraryItemDTO, PlaceDTO, TripDTO } from "@/lib/types";

export default function TripPlanner({
  trip,
  initialItems,
  places,
}: {
  trip: TripDTO;
  initialItems: ItineraryItemDTO[];
  places: PlaceDTO[];
}) {
  const [items, setItems] = useState(initialItems);
  const [activeDay, setActiveDay] = useState(0);
  const [extraDays, setExtraDays] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

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
          icon: meta.icon,
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
                        className="min-w-0 flex-1 text-left"
                        onClick={() => setSelectedId(item.id)}
                      >
                        <p className="truncate text-sm font-medium">{item.title}</p>
                        <p className="truncate text-xs text-muted">
                          {meta.icon} {meta.label}
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
                  </li>
                );
              })}
            </ol>
          )}
        </div>

        {error && <p className="text-xs text-red-500">{error}</p>}

        <AddStop
          places={places}
          usedPlaceIds={new Set(items.map((i) => i.placeId).filter(Boolean) as string[])}
          onAdd={addItem}
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
          fitToken={`trip-${trip.id}-${activeDay}`}
        />
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
  busy,
}: {
  places: PlaceDTO[];
  usedPlaceIds: Set<string>;
  onAdd: (payload: { title: string; placeId?: string | null; category?: string }) => Promise<boolean>;
  busy: boolean;
}) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("other");

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
        placeholder="Search your places, or type anything…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />

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
                  <span aria-hidden>{meta.icon}</span>
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
