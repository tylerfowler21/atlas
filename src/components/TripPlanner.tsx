"use client";

import { useCategories } from "@/components/CategoriesProvider";

import { usePlaceSearch } from "@/lib/use-place-search";
import { tripRegion } from "@/lib/place-groups";
import { currentPosition, nearbyPlaces, HERE_MESSAGES } from "@/lib/here";
import { enrichSelectedPlace } from "@/lib/enrich-place";
import { searchPlaces } from "@/lib/search-places";
import Link from "next/link";
import { useMemo, useState, useRef } from "react";
import MapCanvas, { type MapPin } from "@/components/MapCanvas";
import type { SelectedPlace } from "@/components/map-types";
import EmojiField from "@/components/EmojiField";
import ShareTrip from "@/components/ShareTrip";
import TripPeople from "@/components/TripPeople";
import TripSettings from "@/components/TripSettings";
import { TRAVEL_MODES, travelMode } from "@/lib/taxonomy";
import { dateForDay, dayCount, formatDay, formatRange } from "@/lib/trips";
import { directionsUrl } from "@/lib/directions";
import type { ItineraryItemDTO, PlaceDTO, TripDTO, SearchResult } from "@/lib/types";
import DirectionsIcon from "@/components/DirectionsIcon";
import type { TripRole } from "@/lib/trip-access";
import type { Collaborator } from "@/components/TripPeople";

export default function TripPlanner({
  trip: initialTrip,
  initialItems,
  places,
  role,
  ownerLabel,
  ownerImage,
  people,
}: {
  trip: TripDTO;
  initialItems: ItineraryItemDTO[];
  places: PlaceDTO[];
  role: TripRole;
  ownerLabel: string;
  ownerImage: string | null;
  people: Collaborator[];
}) {
  const { categories, categoryOf, stopIconOf } = useCategories();
  // The trip is editable in place (title, dates, colour), so it lives in state
  // rather than being read straight from props.
  const [trip, setTrip] = useState(initialTrip);
  const [items, setItems] = useState(initialItems);
  const [activeDay, setActiveDay] = useState(0);
  const [extraDays, setExtraDays] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  /// What to narrow the search to: what the trip says it is, or failing that
  /// what its stops say it is. The destination field is optional and most
  /// trips are made without one, so relying on it alone means the narrowing
  /// does not happen for most trips.
  const searchRegion = useMemo(
    () =>
      trip.destination ??
      tripRegion(items.map((i) => i.place).filter((p) => p !== null)),
    [trip.destination, items],
  );

  const [dropMode, setDropMode] = useState(false);
  /// A place Apple labelled that has been tapped, waiting to be confirmed.
  ///
  /// Confirmed rather than added outright: the map is also how you pan and
  /// zoom, and a stop that appears because a finger brushed a café is a worse
  /// failure than one tap more.
  const [tapped, setTapped] = useState<SelectedPlace | null>(null);
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

    const legEnds = items
      .filter((i) => i.kind === "travel" && i.toPlace)
      .map((i) => {
        const meta = travelMode(i.mode);
        return {
          id: `${i.id}-to`,
          lat: i.toPlace!.lat,
          lng: i.toPlace!.lng,
          color: trip.color,
          icon: meta.icon,
          badge: null,
          muted: !dayItems.some((d) => d.id === i.id),
        };
      });

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
          icon: stopIconOf(item),
          badge: badge ? String(badge) : null,
          muted: !badge,
        };
      })
      .concat(legEnds);
  }, [items, dayItems, trip.color, categoryOf, stopIconOf]);

  const legs = useMemo(
    () =>
      dayItems
        .filter((i) => i.kind === "travel" && i.place && i.toPlace)
        .map((i) => ({
          from: [i.place!.lng, i.place!.lat] as [number, number],
          to: [i.toPlace!.lng, i.toPlace!.lat] as [number, number],
        })),
    [dayItems],
  );

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
    kind?: "stop" | "travel";
    toPlaceId?: string | null;
    mode?: string;
    startTime?: string | null;
    endTime?: string | null;
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

  /// Setting a stop's emoji.
  ///
  /// When the stop is a real place the emoji belongs to the *place*, so it is
  /// written there and shows everywhere that place appears — the map, your
  /// places list and the been map. Anything the map has never heard of has no
  /// place to write to, so those keep a per-stop emoji of their own.
  async function setStopEmoji(item: ItineraryItemDTO, emoji: string | null) {
    if (!item.placeId || !item.place) {
      await patchItem(item.id, { emoji });
      return;
    }

    setBusy(true);
    setError(null);

    const res = await fetch(`/api/places/${item.placeId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ emoji }),
    });
    const body = await res.json().catch(() => ({}));
    setBusy(false);

    if (!res.ok) {
      setError(body.error ?? "Could not change that emoji");
      return;
    }

    const placeId = item.placeId;
    setItems((prev) =>
      prev.map((i) =>
        i.placeId === placeId && i.place
          ? // Clear any older per-stop override, which would otherwise keep
            // masking the place's emoji.
            { ...i, emoji: null, place: { ...i.place, emoji } }
          : i,
      ),
    );
    setLibrary((prev) => prev.map((p) => (p.id === placeId ? { ...p, emoji } : p)));

    // An override may still be stored server-side from before this change.
    if (item.emoji) await patchItem(item.id, { emoji: null });
  }

  async function setPublished(next: boolean) {
    setBusy(true);
    setError(null);

    const res = await fetch(`/api/trips/${trip.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ published: next }),
    });
    const body = await res.json().catch(() => ({}));
    setBusy(false);

    if (!res.ok) {
      setError(body.error ?? "Could not change who can see this");
      return;
    }
    setTrip(body.trip);
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

  /// Moving one stop to a particular place in the day, which is what dragging
  /// does. The arrows swap neighbours; this cannot, because dragging the last
  /// stop to the top is not a swap.
  ///
  /// The day is renumbered from zero afterwards and only the rows whose number
  /// actually changed are saved. Positions arrive as whatever earlier edits
  /// left behind, and reasoning about gaps in them is how off-by-one bugs get
  /// in.
  async function moveTo(from: number, to: number) {
    if (from === to) return;

    const next = [...dayItems];
    const [moved] = next.splice(from, 1);
    if (!moved) return;
    next.splice(to, 0, moved);

    // Shown before it is saved. Dragging that snaps back for half a second
    // feels broken even when it worked.
    setItems((prev) => {
      const positions = new Map(next.map((item, i) => [item.id, i]));
      return prev.map((item) =>
        positions.has(item.id) ? { ...item, position: positions.get(item.id)! } : item,
      );
    });

    await Promise.all(
      next
        .map((item, i) => (item.position === i ? null : patchItem(item.id, { position: i })))
        .filter(Boolean),
    );
  }

  /// Dragging a stop up or down the day.
  ///
  /// Pointer events rather than the HTML drag-and-drop API, which does not
  /// exist on touch: a phone fires no dragstart at all, so the whole feature
  /// was invisible on the device most likely to be used while actually on the
  /// trip. Pointer events are the same code for a mouse and a finger.
  const draggingFrom = useRef<number | null>(null);
  const [dragOver, setDragOver] = useState<number | null>(null);
  /// Each row's position on screen, measured when a drag starts, so working out
  /// which row the finger is over is a comparison rather than a hit test on
  /// whatever is under it — the dragged row itself is under it.
  const rowBounds = useRef<{ top: number; bottom: number }[]>([]);
  const listRef = useRef<HTMLOListElement>(null);

  function measureRows() {
    const list = listRef.current;
    if (!list) return;
    rowBounds.current = [...list.querySelectorAll("[data-stop]")].map((el) => {
      const r = el.getBoundingClientRect();
      return { top: r.top, bottom: r.bottom };
    });
  }

  function rowAt(y: number) {
    const rows = rowBounds.current;
    if (rows.length === 0) return null;
    if (y < rows[0]!.top) return 0;
    if (y > rows[rows.length - 1]!.bottom) return rows.length - 1;
    const hit = rows.findIndex((r) => y >= r.top && y <= r.bottom);
    return hit === -1 ? null : hit;
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

          {/* Whether a trip is public should be readable without opening a
              panel — it is the one setting where not knowing is a problem. */}
          {role === "owner" ? (
            <button
              type="button"
              className={`chip mt-2 ${trip.publishedAt ? "is-on" : ""}`}
              disabled={busy}
              onClick={() => setPublished(trip.publishedAt === null)}
              title={
                trip.publishedAt
                  ? "On your profile and in your followers' feeds. Click to make private."
                  : "Only you and anyone you've invited. Click to publish."
              }
            >
              {trip.publishedAt ? "🌍 Published" : "🔒 Private"}
            </button>
          ) : (
            <span className="chip mt-2">✏️ Shared with you</span>
          )}
        </div>

        {/* Renaming, sharing and deleting stay with the owner; an editor gets
            the itinerary and nothing else. */}
        {role === "owner" && (
          <>
            <TripSettings trip={trip} onUpdated={setTrip} />
            <ShareTrip tripId={trip.id} />
          </>
        )}

        <TripPeople
          tripId={trip.id}
          role={role}
          ownerLabel={ownerLabel}
          ownerImage={ownerImage}
          initialPeople={people}
        />

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
            <ol ref={listRef} className="mt-2 space-y-2">
              {dayItems.length > 1 && (
                // Only where dragging works. Touch does not fire the HTML drag
                // events, and the arrows are still there for that — and for
                // anybody doing this from a keyboard.
                <li className="text-xs text-muted">
                  Drag a stop by its number to reorder the day.
                </li>
              )}
              {dayItems.map((item, index) => {
                const meta = categoryOf(item.category);
                return (
                  <li
                    key={item.id}
                    data-stop
                    className={`card p-2.5 transition-colors ${
                      selectedId === item.id ? "ring-2 ring-accent" : ""
                    } ${dragOver === index ? "ring-2 ring-accent/60" : ""}`}
                  >
                    <div className="flex items-start gap-2.5">
                      <span
                        title="Drag to reorder"
                        aria-label={`Stop ${index + 1}. Drag to reorder.`}
                        className="grid size-7 shrink-0 cursor-grab touch-none place-items-center rounded-full text-xs font-semibold text-white select-none active:cursor-grabbing"
                        style={{ background: trip.color }}
                        onPointerDown={(e) => {
                          if (busy) return;
                          // Keeps the page from scrolling under the finger and
                          // routes every later move here even once the pointer
                          // has left this little circle.
                          e.currentTarget.setPointerCapture(e.pointerId);
                          measureRows();
                          draggingFrom.current = index;
                          setDragOver(index);
                        }}
                        onPointerMove={(e) => {
                          if (draggingFrom.current === null) return;
                          const over = rowAt(e.clientY);
                          if (over !== null && over !== dragOver) setDragOver(over);
                        }}
                        onPointerUp={async () => {
                          const from = draggingFrom.current;
                          const to = dragOver;
                          draggingFrom.current = null;
                          setDragOver(null);
                          if (from !== null && to !== null) await moveTo(from, to);
                        }}
                        onPointerCancel={() => {
                          draggingFrom.current = null;
                          setDragOver(null);
                        }}
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
                        {stopIconOf(item)}
                      </button>
                      <button
                        type="button"
                        className="min-w-0 flex-1 text-left"
                        onClick={() => setSelectedId(item.id)}
                      >
                        <p className="truncate text-sm font-medium">{item.title}</p>
                        {item.kind === "travel" ? (
                          <p className="truncate text-xs text-muted">
                            {travelMode(item.mode).label}
                            {item.place && item.toPlace
                              ? ` · ${item.place.name} → ${item.toPlace.name}`
                              : ""}
                            {item.startTime && item.endTime
                              ? ` · ${item.startTime}–${item.endTime}`
                              : ""}
                          </p>
                        ) : (
                          <p className="truncate text-xs text-muted">
                            {meta.label}
                            {item.place?.city ? ` · ${item.place.city}` : ""}
                          </p>
                        )}
                      </button>
                      <div className="flex shrink-0 items-center gap-1">
                        <input
                          type="time"
                          aria-label={item.kind === "travel" ? "Departure time" : "Start time"}
                          className="input w-24 px-1.5 py-1 text-xs"
                          value={item.startTime ?? ""}
                          onChange={(e) =>
                            patchItem(item.id, { startTime: e.target.value || null })
                          }
                        />
                        {item.kind === "travel" && (
                          <>
                            <span aria-hidden className="text-xs text-muted">
                              →
                            </span>
                            <input
                              type="time"
                              aria-label="Arrival time"
                              className="input w-24 px-1.5 py-1 text-xs"
                              value={item.endTime ?? ""}
                              onChange={(e) =>
                                patchItem(item.id, { endTime: e.target.value || null })
                              }
                            />
                          </>
                        )}
                      </div>
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
                      {/* On the row itself, not only inside an expanded stop.
                          Directions are what you want while standing in the
                          street, and having to open a stop first to reach them
                          is one tap too many at exactly the wrong moment. */}
                      {item.place && (
                        <a
                          href={directionsUrl({
                            lat: item.place.lat,
                            lng: item.place.lng,
                            name: item.place.name,
                          })}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          aria-label={`Directions to ${item.place.name}`}
                          title={`Directions to ${item.place.name}`}
                          className="ml-auto rounded px-1.5 py-0.5 hover:bg-foreground/5"
                        >
                          <DirectionsIcon />
                        </a>
                      )}
                    </div>

                    {emojiFor === item.id && (
                      <div className="mt-2 border-t border-line pt-2">
                        <EmojiField
                          emoji={item.place ? item.place.emoji : item.emoji}
                          category={item.category}
                          fallback={categoryOf(item.category).icon}
                          onChange={(emoji) => setStopEmoji(item, emoji)}
                        />
                        <p className="mt-1.5 text-xs text-muted">
                          {item.place ? (
                            <>
                              Applies to{" "}
                              <span className="font-medium">{item.place.name}</span>{" "}
                              everywhere — the map, your places and your been map.
                            </>
                          ) : (
                            "Applies to this entry. It isn't a place on the map, so it has nowhere else to show."
                          )}
                        </p>
                      </div>
                    )}

                    {selectedId === item.id && (
                      <div className="mt-2 space-y-1.5 border-t border-line pt-2">
                        <input
                          // Uncontrolled and saved on blur, like the notes below:
                          // no request per keystroke, and `key` resets it when a
                          // different stop is selected.
                          key={`name-${item.id}`}
                          className="input text-sm"
                          aria-label="Name of this stop"
                          defaultValue={item.title}
                          onBlur={(e) => {
                            const next = e.target.value.trim();
                            if (next && next !== item.title) patchItem(item.id, { title: next });
                            else e.target.value = item.title;
                          }}
                        />

                        <select
                          aria-label="Category for this stop"
                          className="input text-xs"
                          value={item.category}
                          onChange={(e) => patchItem(item.id, { category: e.target.value })}
                        >
                          {categories.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.icon} {c.label}
                            </option>
                          ))}
                        </select>

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
                        {item.kind === "travel" && item.place && item.toPlace && (
                          <a
                            href={directionsUrl(
                              { lat: item.toPlace.lat, lng: item.toPlace.lng, name: item.toPlace.name },
                              { lat: item.place.lat, lng: item.place.lng, name: item.place.name },
                              travelMode(item.mode).dirflg,
                            )}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-accent-text hover:underline"
                          >
                            {travelMode(item.mode).label} times: {item.place.name} →{" "}
                            {item.toPlace.name} →
                          </a>
                        )}

                        {item.kind !== "travel" && item.place && (
                          <div className="flex flex-wrap items-center gap-3">
                            <Link
                              href={`/?place=${item.place.id}`}
                              className="text-xs text-accent-text hover:underline"
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
                              className="inline-flex items-center gap-1 text-xs text-accent-text hover:underline"
                            >
                              <DirectionsIcon />
                              Directions
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
                                  className="text-xs text-accent-text hover:underline"
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

        <AddTravel places={library} onAdd={addItem} busy={busy} />

        <AddStop
          destination={searchRegion}
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

      {/* A real height rather than a minimum: the map fills its box with a
          percentage height, which needs something definite to resolve against.
          See the same note in SharedTrip. */}
      <div className="relative h-[55vh] lg:h-auto lg:min-h-0 lg:flex-1">
        <MapCanvas
          pins={pins}
          route={route}
          legs={legs}
          routeColor={trip.color}
          selectedId={selectedId}
          onSelect={setSelectedId}
          onMapClick={dropMode ? dropPin : undefined}
          onPlaceSelect={setTapped}
          fitToken={`trip-${trip.id}-${activeDay}`}
        />

        {tapped && (
          <div className="absolute inset-x-0 bottom-3 flex justify-center px-3">
            <div className="card flex max-w-sm items-center gap-3 p-3 shadow-lg">
              <span aria-hidden className="text-lg">
                {categoryOf(tapped.category).icon}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{tapped.name}</p>
                <p className="text-xs text-muted">
                  Add to day {activeDay + 1}?
                </p>
              </div>
              <button
                type="button"
                className="btn btn-primary shrink-0 text-xs"
                disabled={busy}
                onClick={async () => {
                  const place = tapped;
                  setTapped(null);
                  // With where it is, so it counts towards the city and country
                  // totals like anything else saved.
                  await addNewPlace(await enrichSelectedPlace(place));
                }}
              >
                Add
              </button>
              <button
                type="button"
                className="shrink-0 text-xs text-muted hover:underline"
                onClick={() => setTapped(null)}
              >
                No
              </button>
            </div>
          </div>
        )}
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

/// Adding a journey between two places you have already saved. Getting from
/// city to city is most of an international trip, and it is a leg rather than
/// a stop: two ends, a departure and an arrival.
function AddTravel({
  places,
  onAdd,
  busy,
}: {
  places: PlaceDTO[];
  onAdd: (payload: {
    title: string;
    placeId?: string | null;
    category?: string;
    kind?: "stop" | "travel";
    toPlaceId?: string | null;
    mode?: string;
    startTime?: string | null;
    endTime?: string | null;
  }) => Promise<boolean>;
  busy: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<string>("train");
  const [fromId, setFromId] = useState("");
  const [toId, setToId] = useState("");
  const [departs, setDeparts] = useState("");
  const [arrives, setArrives] = useState("");

  const from = places.find((p) => p.id === fromId);
  const to = places.find((p) => p.id === toId);

  if (!open) {
    return (
      <button
        type="button"
        className="self-start text-xs text-muted hover:underline"
        onClick={() => setOpen(true)}
      >
        + Add a train, flight or ferry
      </button>
    );
  }

  return (
    <div className="card space-y-3 p-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold">Getting somewhere</h2>
          <p className="mt-0.5 text-xs text-muted">
            A journey between two places you&apos;ve saved. Both ends show on the
            map, joined by a line.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setOpen(false)}
          aria-label="Close"
          className="rounded-md px-2 py-1 text-muted hover:bg-foreground/5"
        >
          ✕
        </button>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {TRAVEL_MODES.map((m) => (
          <button
            key={m.id}
            type="button"
            className={`chip ${mode === m.id ? "is-on" : ""}`}
            onClick={() => setMode(m.id)}
          >
            <span aria-hidden>{m.icon}</span>
            {m.label}
          </button>
        ))}
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        <label className="text-xs text-muted">
          From
          <select
            className="input mt-1"
            value={fromId}
            onChange={(e) => setFromId(e.target.value)}
          >
            <option value="">Choose a place…</option>
            {places.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs text-muted">
          To
          <select
            className="input mt-1"
            value={toId}
            onChange={(e) => setToId(e.target.value)}
          >
            <option value="">Choose a place…</option>
            {places.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        <label className="text-xs text-muted">
          Departs
          <input
            type="time"
            className="input mt-1"
            value={departs}
            onChange={(e) => setDeparts(e.target.value)}
          />
        </label>
        <label className="text-xs text-muted">
          Arrives
          <input
            type="time"
            className="input mt-1"
            value={arrives}
            onChange={(e) => setArrives(e.target.value)}
          />
        </label>
      </div>

      {places.length < 2 && (
        <p className="text-xs text-amber-600 dark:text-amber-400">
          You need two saved places to travel between. Add them above first.
        </p>
      )}

      {fromId && fromId === toId && (
        <p className="text-xs text-amber-600 dark:text-amber-400">
          That journey starts and ends in the same place.
        </p>
      )}

      <button
        type="button"
        className="btn btn-primary"
        disabled={busy || !from || !to || fromId === toId}
        onClick={async () => {
          const ok = await onAdd({
            kind: "travel",
            mode,
            title: `${travelMode(mode).label} to ${to!.name}`,
            placeId: fromId,
            toPlaceId: toId,
            category: "transport",
            startTime: departs || null,
            endTime: arrives || null,
          });
          if (ok) {
            setOpen(false);
            setFromId("");
            setToId("");
            setDeparts("");
            setArrives("");
          }
        }}
      >
        {busy ? "Adding…" : "Add this journey"}
      </button>
    </div>
  );
}

/// The add-a-stop control: pick one of your saved places, or type anything
/// that isn't a place ("Train to Porto") as a plain entry.
function AddStop({
  destination,
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
  /// Where the trip is. Searching "Time Out Market" from inside a trip to
  /// Lisbon should not begin with the one in New York.
  destination: string | null;
}) {
  const { categories, categoryOf, placeIconOf } = useCategories();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("other");
  // Searching the wider world from inside a trip, so adding somewhere new no
  // longer means a detour to the map and back.
  const trimmed = query.trim();
  const { results: worldResults } = usePlaceSearch(trimmed, (q, mode) =>
    searchPlaces(q, mode, destination),
  );

  /// Split by whether the result is where this trip is. Everywhere else is
  /// kept — a trip to Lisbon can still have a day in Sintra, and the gazetteer
  /// does not always agree about which country a place is in — but it does not
  /// get to lead.
  /// Whatever is around wherever you are standing, once you have asked.
  ///
  /// This is the reason to have the app open while actually on the trip: you
  /// are in the place, you want it on today, and typing its name is the long
  /// way round when the phone already knows where it is.
  const [around, setAround] = useState<SearchResult[] | null>(null);
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);

  async function findMe() {
    setLocating(true);
    setLocationError(null);

    const position = await currentPosition();
    if (!position.ok) {
      setLocating(false);
      setLocationError(HERE_MESSAGES[position.error]);
      return;
    }

    try {
      const found = await nearbyPlaces(position.lat, position.lng);
      setAround(found);
      if (found.length === 0) {
        setLocationError("Nothing named around here — try dropping a pin instead.");
      }
    } catch {
      setLocationError("Couldn't look up what's around you.");
    } finally {
      setLocating(false);
    }
  }

  const here = worldResults.filter((r) => r.nearby);
  const elsewhere = worldResults.filter((r) => !r.nearby);
  const [showElsewhere, setShowElsewhere] = useState(false);
  const shown = destination && here.length > 0 && !showElsewhere ? here : worldResults;

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

        <button
          type="button"
          className="chip"
          disabled={locating}
          onClick={() => void findMe()}
        >
          📍 {locating ? "Finding you…" : "I'm here now"}
        </button>

        {notice && <span className="text-xs text-muted">{notice}</span>}
      </div>

      {locationError && <p className="mt-1.5 text-xs text-muted">{locationError}</p>}

      {around && around.length > 0 && (
        <>
          <div className="mt-3 mb-1 flex items-center gap-2">
            <p className="text-xs tracking-wide text-muted uppercase">Around you</p>
            <button
              type="button"
              className="text-xs text-muted hover:underline"
              onClick={() => setAround(null)}
            >
              clear
            </button>
          </div>
          <ul className="divide-y divide-line overflow-hidden rounded-lg border border-line">
            {around.map((r) => (
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
                    setAround(null);
                  }}
                >
                  <span aria-hidden>{categoryOf(r.category).icon}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm">{r.name}</span>
                    <span className="block truncate text-xs text-muted">
                      {r.address ?? r.city ?? ""}
                    </span>
                  </span>
                  <span className="text-xs text-accent-text">Add</span>
                </button>
              </li>
            ))}
          </ul>
        </>
      )}

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
                  <span aria-hidden>{placeIconOf(place)}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm">{place.name}</span>
                    <span className="block truncate text-xs text-muted">
                      {[place.city, place.country].filter(Boolean).join(", ") || meta.label}
                    </span>
                  </span>
                  <span className="text-xs text-accent-text">Add</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {trimmed.length >= 3 && worldResults.length > 0 && (
        <>
          <p className="mt-3 mb-1 text-xs tracking-wide text-muted uppercase">
            {destination && here.length > 0 && !showElsewhere
              ? `In ${destination}`
              : "Somewhere new"}
          </p>
          <ul className="divide-y divide-line overflow-hidden rounded-lg border border-line">
            {shown.map((r) => (
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
                  }}
                >
                  <span aria-hidden>{categoryOf(r.category).icon}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm">{r.name}</span>
                    <span className="block truncate text-xs text-muted">{r.context}</span>
                  </span>
                  <span className="text-xs text-accent-text">Save &amp; add</span>
                </button>
              </li>
            ))}
          </ul>

          {destination && here.length > 0 && elsewhere.length > 0 && (
            <button
              type="button"
              className="mt-1.5 text-xs text-muted hover:underline"
              onClick={() => setShowElsewhere((v) => !v)}
            >
              {showElsewhere
                ? `Just the ones in ${destination}`
                : `${elsewhere.length} more elsewhere in the world`}
            </button>
          )}
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
            {categories.map((c) => (
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
          <Link href="/" className="text-accent-text underline">
            find some on the map
          </Link>
          .
        </p>
      )}
    </div>
  );
}
