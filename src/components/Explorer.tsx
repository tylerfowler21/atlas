"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import MapCanvas, { type MapPin } from "@/components/MapCanvas";
import PlaceForm from "@/components/PlaceForm";
import PlaceDetail from "@/components/PlaceDetail";
import { CATEGORIES, category as categoryOf, placeIcon, STATUSES } from "@/lib/taxonomy";
import type { PlaceDTO, PlaceDraft, SearchResult, TripDTO } from "@/lib/types";

const DRAFT_PIN_ID = "__draft__";

export default function Explorer({
  initialPlaces,
  trips,
  initialSelectedId = null,
}: {
  initialPlaces: PlaceDTO[];
  trips: TripDTO[];
  /// Arriving from ?place=<id>: open this place and centre on it.
  initialSelectedId?: string | null;
}) {
  const [places, setPlaces] = useState(initialPlaces);
  const [query, setQuery] = useState("");
  // Search results are stored with the query they belong to, so "is this
  // stale?" is a comparison rather than another piece of state to keep in sync.
  const [search, setSearch] = useState<{ q: string; items: SearchResult[] }>({
    q: "",
    items: [],
  });
  const [draft, setDraft] = useState<PlaceDraft | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(initialSelectedId);
  const [dropMode, setDropMode] = useState(false);
  const searchParams = useSearchParams();

  /// Read from the address so ?status=visited is a link to "everywhere I have
  /// been" — which is what the retired /been page redirects to. It also widens
  /// to "lived", which the chips already offered and this state did not, so
  /// picking "Lived there" used to filter to nothing.
  const [statusFilter, setStatusFilter] = useState<
    "all" | "wishlist" | "visited" | "lived"
  >(() => {
    const wanted = searchParams.get("status");
    return wanted === "wishlist" || wanted === "visited" || wanted === "lived"
      ? wanted
      : "all";
  });
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [fitSeq, setFitSeq] = useState(0);
  const [focus, setFocus] = useState<{ lat: number; lng: number; token: number } | null>(
    // Computed once, from the initial props: a deep link should land centred on
    // its place rather than fitting the whole world and then jumping.
    () => {
      const target = initialPlaces.find((p) => p.id === initialSelectedId);
      return target ? { lat: target.lat, lng: target.lng, token: 1 } : null;
    },
  );
  const [notice, setNotice] = useState<string | null>(null);
  // The list is useful, but this is a map — being able to get it out of the
  // way matters most on a phone, where it otherwise fills the screen.
  const [listOpen, setListOpen] = useState(true);
  /// The scrolling panel itself, so opening a place can return it to the top.
  const sheetRef = useRef<HTMLDivElement>(null);
  // How far the sheet has been dragged from its resting position, in pixels.
  // Non-zero only while a finger is down, so the sheet follows the thumb
  // instead of only responding to a tap on something that looks draggable.
  const [drag, setDrag] = useState(0);
  const dragFrom = useRef<number | null>(null);

  // --- world search, debounced to respect the geocoder's rate limit ---------
  const requestId = useRef(0);
  const trimmedQuery = query.trim();

  useEffect(() => {
    if (trimmedQuery.length < 3) return;

    const id = ++requestId.current;
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/geocode?q=${encodeURIComponent(trimmedQuery)}`);
        const body = await res.json();
        // Ignore anything that came back after a newer keystroke.
        if (id !== requestId.current) return;
        setSearch({ q: trimmedQuery, items: body.results ?? [] });
      } catch {
        if (id === requestId.current) setSearch({ q: trimmedQuery, items: [] });
      }
    }, 450);

    return () => clearTimeout(timer);
  }, [trimmedQuery]);

  const results = search.q === trimmedQuery ? search.items : [];
  const searching = trimmedQuery.length >= 3 && search.q !== trimmedQuery;

  const visiblePlaces = useMemo(
    () =>
      places.filter(
        (p) =>
          (statusFilter === "all" || p.status === statusFilter) &&
          !hidden.has(p.category),
      ),
    [places, statusFilter, hidden],
  );

  const localMatches = useMemo(() => {
    const q = trimmedQuery.toLowerCase();
    if (q.length === 0) return visiblePlaces;
    return visiblePlaces.filter((p) =>
      [p.name, p.city, p.country, p.notes]
        .filter(Boolean)
        .some((field) => field!.toLowerCase().includes(q)),
    );
  }, [visiblePlaces, trimmedQuery]);

  const pins = useMemo<MapPin[]>(() => {
    const list: MapPin[] = visiblePlaces.map((p) => {
      const meta = categoryOf(p.category);
      return {
        id: p.id,
        lat: p.lat,
        lng: p.lng,
        color: meta.color,
        icon: placeIcon(p),
        muted: p.status === "visited",
      };
    });

    if (draft) {
      list.push({
        id: DRAFT_PIN_ID,
        lat: draft.lat,
        lng: draft.lng,
        color: categoryOf(draft.category).color,
        icon: "✨",
      });
    }
    return list;
  }, [visiblePlaces, draft]);

  const selected = places.find((p) => p.id === selectedId) ?? null;

  /// Pan the map to one place. A monotonic token, rather than a timestamp,
  /// keeps this pure enough for the React compiler to reason about.
  function panTo(lat: number, lng: number) {
    setFocus((prev) => ({ lat, lng, token: (prev?.token ?? 0) + 1 }));
  }

  function pickResult(result: SearchResult) {
    setSelectedId(null);
    setDraft({
      name: result.name,
      lat: result.lat,
      lng: result.lng,
      address: result.address,
      city: result.city,
      country: result.country,
      countryCode: result.countryCode,
      category: result.category,
    });
    panTo(result.lat, result.lng);
  }

  async function dropPin(lat: number, lng: number) {
    setDropMode(false);
    setSelectedId(null);
    setNotice("Looking up that spot…");

    try {
      const res = await fetch(`/api/geocode/reverse?lat=${lat}&lng=${lng}`);
      const body = await res.json();
      setDraft({ ...body.result, name: body.result.name || "" });
    } catch {
      setDraft({
        name: "",
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

  const wishlistCount = places.filter((p) => p.status === "wishlist").length;
  const visitedCount = places.length - wishlistCount;

  return (
    <div className="relative h-full lg:flex">
      {/* On a phone this is a sheet sitting over a full-screen map; from lg up
          it is an ordinary sidebar beside it. One component, two shapes. */}
      <aside
        ref={sheetRef}
        style={drag ? { transform: `translateY(${drag}px)` } : undefined}
        className={`absolute inset-x-0 bottom-0 z-10 flex flex-col gap-3 rounded-t-2xl border-t border-line bg-surface p-3 shadow-2xl lg:static lg:order-1 lg:h-full lg:w-96 lg:max-h-none lg:translate-y-0 lg:rounded-none lg:border-t-0 lg:border-r lg:shadow-none ${
          drag ? "" : "transition-[max-height,transform] duration-200"
        } ${listOpen ? "max-h-[78%] overflow-y-auto" : "overflow-visible lg:hidden"}`}
      >
        {/* Drag it or tap it. A short drag counts as a tap, so the sheet never
            feels stuck when a finger moves a few pixels. */}
        <button
          type="button"
          aria-expanded={listOpen}
          aria-label={listOpen ? "Hide your places" : "Show your places"}
          className="-mt-1 mb-1 flex shrink-0 cursor-grab touch-none justify-center py-2 active:cursor-grabbing lg:hidden"
          onPointerDown={(e) => {
            dragFrom.current = e.clientY;
            // Capture keeps the drag alive if the finger leaves the handle,
            // but a drag must not depend on it succeeding.
            try {
              e.currentTarget.setPointerCapture(e.pointerId);
            } catch {}
          }}
          onPointerMove={(e) => {
            if (dragFrom.current === null) return;
            const delta = e.clientY - dragFrom.current;
            // Only downward when open, only upward when closed; the other
            // direction has nowhere to go.
            setDrag(listOpen ? Math.max(0, delta) : Math.min(0, delta));
          }}
          onPointerUp={(e) => {
            const start = dragFrom.current;
            dragFrom.current = null;
            const delta = start === null ? 0 : e.clientY - start;

            // Decide first, tidy up after: releasing capture can throw, and a
            // throw here used to swallow the whole gesture.
            setDrag(0);
            if (Math.abs(delta) < 6) {
              setListOpen((v) => !v);   // a tap
            } else if (delta > 48) {
              setListOpen(false);
            } else if (delta < -48) {
              setListOpen(true);
            }

            try {
              e.currentTarget.releasePointerCapture(e.pointerId);
            } catch {}
          }}
          onPointerCancel={() => {
            dragFrom.current = null;
            setDrag(0);
          }}
        >
          <span className="h-1.5 w-12 rounded-full bg-foreground/25" />
        </button>

        {draft ? (
          <PlaceForm
            draft={draft}
            onCancel={() => setDraft(null)}
            onSaved={(place) => {
              setPlaces((prev) => [place, ...prev]);
              setDraft(null);
              setQuery("");
              setSearch({ q: "", items: [] });
              setSelectedId(place.id);
            }}
          />
        ) : selected ? (
          <PlaceDetail
            key={selected.id}
            place={selected}
            trips={trips}
            onUpdated={(updated) =>
              setPlaces((prev) => prev.map((p) => (p.id === updated.id ? updated : p)))
            }
            onDeleted={(id) => {
              setPlaces((prev) => prev.filter((p) => p.id !== id));
              setSelectedId(null);
            }}
            onClose={() => setSelectedId(null)}
          />
        ) : (
          <>
            <div>
              <div className="mb-2 hidden justify-end lg:flex">
                <button
                  type="button"
                  className="text-xs text-muted hover:underline"
                  onClick={() => setListOpen(false)}
                >
                  Hide list ‹
                </button>
              </div>
              <input
                className="input"
                value={query}
                placeholder="Search your places or anywhere in the world…"
                onChange={(e) => setQuery(e.target.value)}
              />
              <div className="mt-2 flex items-center justify-between gap-2">
                <button
                  type="button"
                  className={`chip ${dropMode ? "is-on" : ""}`}
                  onClick={() => setDropMode((v) => !v)}
                >
                  📌 {dropMode ? "Click the map…" : "Drop a pin"}
                </button>
                <span className="text-xs text-muted">
                  {listOpen ? (
                    <>
                      {wishlistCount} to go · {visitedCount} visited
                    </>
                  ) : (
                    <>{visiblePlaces.length} places — pull up to see them</>
                  )}
                </span>
              </div>
            </div>

            <div className={`flex-wrap gap-1.5 ${listOpen ? "flex" : "hidden lg:flex"}`}>
              {[{ id: "all", label: "All", icon: "•" }, ...STATUSES].map((s) => (
                <button
                  key={s.id}
                  type="button"
                  className={`chip ${statusFilter === s.id ? "is-on" : ""}`}
                  onClick={() => {
                    setStatusFilter(s.id as typeof statusFilter);
                    setFitSeq((n) => n + 1);
                  }}
                >
                  <span aria-hidden>{s.icon}</span>
                  {s.label}
                </button>
              ))}
            </div>

            <div className={`flex-wrap gap-1.5 ${listOpen ? "flex" : "hidden lg:flex"}`}>
              {CATEGORIES.map((c) => {
                const on = !hidden.has(c.id);
                return (
                  <button
                    key={c.id}
                    type="button"
                    aria-pressed={on}
                    className={`chip ${on ? "is-on" : ""}`}
                    style={on ? { borderColor: c.color } : { opacity: 0.5 }}
                    onClick={() =>
                      setHidden((prev) => {
                        const next = new Set(prev);
                        if (next.has(c.id)) next.delete(c.id);
                        else next.add(c.id);
                        return next;
                      })
                    }
                  >
                    <span aria-hidden>{c.icon}</span>
                    {c.label}
                  </button>
                );
              })}
            </div>

            {notice && <p className="text-xs text-muted">{notice}</p>}

            <section className={`min-h-0 ${listOpen ? "" : "hidden lg:block"}`}>
              <h2 className="mb-1.5 text-xs font-medium tracking-wide text-muted uppercase">
                Your places ({localMatches.length})
              </h2>
              {localMatches.length === 0 ? (
                places.length === 0 ? (
                  // A brand-new account lands on an empty world map. Pasting a
                  // trip you have already taken is by far the fastest way to a
                  // map that feels like yours, so lead with it.
                  <div className="card space-y-3 p-3">
                    <p className="text-sm font-medium">Your map is empty</p>
                    <p className="text-xs text-muted">
                      The quickest start is a trip you&apos;ve already taken — paste
                      where you went and every place gets found and pinned for you.
                    </p>
                    <Link href="/trips/import" className="btn btn-primary w-full justify-center">
                      Paste a trip you&apos;ve taken
                    </Link>
                    <p className="text-xs text-muted">
                      Or search for somewhere above, or press{" "}
                      <span className="font-medium">Drop a pin</span> and click the map.
                    </p>
                  </div>
                ) : (
                  <p className="text-xs text-muted">No saved places match.</p>
                )
              ) : (
                <ul className="divide-y divide-line overflow-hidden rounded-lg border border-line">
                  {localMatches.map((p) => {
                    const meta = categoryOf(p.category);
                    return (
                      <li key={p.id}>
                        <button
                          type="button"
                          className="flex w-full items-center gap-2.5 px-2.5 py-2 text-left hover:bg-foreground/5"
                          onClick={() => {
                            setSelectedId(p.id);
                            panTo(p.lat, p.lng);
                          }}
                        >
                          <span
                            aria-hidden
                            className="grid size-7 shrink-0 place-items-center rounded-full text-xs"
                            style={{ background: `${meta.color}22` }}
                          >
                            {placeIcon(p)}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm">{p.name}</span>
                            <span className="block truncate text-xs text-muted">
                              {[p.city, p.country].filter(Boolean).join(", ") || meta.label}
                            </span>
                          </span>
                          {p.status === "visited" && (
                            <span aria-label="visited" className="text-xs">
                              ✅
                            </span>
                          )}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>

            {trimmedQuery.length >= 3 && (
              <section>
                <h2 className="mb-1.5 text-xs font-medium tracking-wide text-muted uppercase">
                  {searching ? "Searching the world…" : "Search results"}
                </h2>
                {!searching && results.length === 0 ? (
                  <p className="text-xs text-muted">Nothing found for that.</p>
                ) : (
                  <ul className="divide-y divide-line overflow-hidden rounded-lg border border-line">
                    {results.map((r) => (
                      <li key={r.id}>
                        <button
                          type="button"
                          className="flex w-full items-center gap-2.5 px-2.5 py-2 text-left hover:bg-foreground/5"
                          onClick={() => pickResult(r)}
                        >
                          <span aria-hidden className="text-sm">
                            {categoryOf(r.category).icon}
                          </span>
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
              </section>
            )}
          </>
        )}
      </aside>

      <div className="absolute inset-0 lg:static lg:order-2 lg:min-h-0 lg:flex-1">
        {!listOpen && (
          <button
            type="button"
            className="card absolute top-3 left-3 z-10 hidden px-3 py-1.5 text-xs font-medium shadow-lg lg:block"
            onClick={() => setListOpen(true)}
          >
            ☰ Your places ({visiblePlaces.length})
          </button>
        )}
        <MapCanvas
          pins={pins}
          selectedId={draft ? DRAFT_PIN_ID : selectedId}
          fitToken={String(fitSeq)}
          focus={focus}
          onSelect={(id) => {
            if (id === DRAFT_PIN_ID) return;
            setDraft(null);
            setSelectedId(id);
            // Opening from the map has to open the panel too, and start it at
            // the top: it may be scrolled from whatever was being read before,
            // and a place opened half way down reads as a different screen.
            setListOpen(true);
            sheetRef.current?.scrollTo({ top: 0 });
          }}
          // Tapping the map is also how you put the panel away. On a phone it
          // covers the map entirely, so the thing you are trying to get back to
          // is the most natural thing to tap — and there was nothing behind
          // that gesture before.
          onMapClick={
            dropMode
              ? dropPin
              : selectedId
                ? () => setSelectedId(null)
                : undefined
          }
        />
        {dropMode && (
          <div className="pointer-events-none absolute inset-x-0 top-3 flex justify-center">
            <p className="card px-3 py-1.5 text-xs shadow-lg">
              Click anywhere on the map to drop a pin
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
