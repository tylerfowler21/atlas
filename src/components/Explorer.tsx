"use client";

import { useCategories } from "@/components/CategoriesProvider";
import StatusIcon from "@/components/StatusIcon";
import PlaceThumb from "@/components/PlaceThumb";
import FirstSteps from "@/components/FirstSteps";
import ShareArea from "@/components/ShareArea";
import { groupPlaces } from "@/lib/place-groups";
import type { FirstSteps as Steps } from "@/lib/first-steps";

import { usePlaceSearch } from "@/lib/use-place-search";
import { useIsPhone } from "@/lib/use-phone";
import { searchPlaces } from "@/lib/search-places";
import Link from "next/link";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import MapCanvas, { type MapPin } from "@/components/MapCanvas";
import OttoIntro from "@/components/OttoIntro";
import PlaceForm from "@/components/PlaceForm";
import PlaceDetail from "@/components/PlaceDetail";
import { STATUSES, status as statusOf } from "@/lib/taxonomy";
import type { PlaceDTO, PlaceDraft, SearchResult, TripDTO } from "@/lib/types";
import type { SelectedPlace } from "@/components/map-types";
import { enrichSelectedPlace } from "@/lib/enrich-place";
import { useSearch } from "@/components/SearchProvider";
import { WORLD_SPAN, inView, viewName, viewSubtitle, type Bounds } from "@/lib/map-view";

const DRAFT_PIN_ID = "__draft__";

/// A place's own rating, out of five.
///
/// Rendered as text rather than as five icons: a screen reader announcing
/// "star star star star star" tells you nothing about how many are filled.
function Stars({ value }: { value: number }) {
  return (
    <span className="mt-0.5 block text-xs leading-none" aria-label={`Rated ${value} out of 5`}>
      <span aria-hidden>
        {[1, 2, 3, 4, 5].map((n) => (
          <span key={n} className={n <= value ? "text-accent" : "text-muted/35"}>
            ★
          </span>
        ))}
      </span>
    </span>
  );
}

export default function Explorer({
  initialPlaces,
  trips,
  initialSelectedId = null,
  firstSteps = null,
  user,
  otto = false,
}: {
  initialPlaces: PlaceDTO[];
  trips: TripDTO[];
  /// Arriving from ?place=<id>: open this place and centre on it.
  initialSelectedId?: string | null;
  /// The short list of first steps, or null once it is finished or hidden.
  firstSteps?: Steps | null;
  /// Whether to stand Otto on the map. Decided on the server — he is not
  /// offered to everybody yet.
  otto?: boolean;
  /// Only for the avatar beside the search on a phone, where the bar that
  /// usually carries it is hidden.
  user?: { name: string | null; image: string | null };
}) {
  const { categories, categoryOf, placeIconOf } = useCategories();
  const [places, setPlaces] = useState(initialPlaces);
  /// What is being searched for lives in the layout above this page, because
  /// the box that sets it is the one in the top bar. This page keeps a field
  /// of its own only below `sm`, where the bar has no room for one.
  const { query, setQuery } = useSearch();
  // Search results are stored with the query they belong to, so "is this
  // stale?" is a comparison rather than another piece of state to keep in sync.
  const [draft, setDraft] = useState<PlaceDraft | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(initialSelectedId);
  const searchParams = useSearchParams();
  const router = useRouter();

  /// Drop-a-pin lives in the address rather than in state, because "Add place"
  /// in the top bar is a link and a link to a page you are already on does not
  /// remount anything. Read the mode from the URL and the button works the
  /// second time as well as the first.
  const dropMode = searchParams.get("add") === "pin";
  function setDropMode(on: boolean) {
    const next = new URLSearchParams(searchParams.toString());
    if (on) next.set("add", "pin");
    else next.delete("add");
    const query = next.toString();
    router.replace(query ? `/?${query}` : "/", { scroll: false });
  }

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
  /// Whether the list of saved places is expanded. Separate from `listOpen`,
  /// which hides the whole sidebar: this collapses the long scroll and leaves
  /// the search and the filters where they are.
  const [placesOpen, setPlacesOpen] = useState(true);
  /// The centre of the map, so a search knows where it is being asked from.
  /// Held in a ref rather than state: it changes on every pan, and the search
  /// reads it when somebody types rather than re-running because the map
  /// drifted a mile.
  const viewport = useRef<{ lat: number; lng: number } | null>(null);
  const [focus, setFocus] = useState<{ lat: number; lng: number; token: number } | null>(
    // Computed once, from the initial props: a deep link should land centred on
    // its place rather than fitting the whole world and then jumping.
    () => {
      const target = initialPlaces.find((p) => p.id === initialSelectedId);
      return target ? { lat: target.lat, lng: target.lng, token: 1 } : null;
    },
  );
  const [notice, setNotice] = useState<string | null>(null);
  /// Whether the list of your cities is showing.
  const [citiesOpen, setCitiesOpen] = useState(false);
  // The list is useful, but this is a map — being able to get it out of the
  // way matters most on a phone, where it otherwise fills the screen.
  /// Open on a laptop, a peek on a phone — until somebody says otherwise.
  ///
  /// Null is "never touched", so the default can follow the screen without a
  /// second piece of state to remember whether it still applies. On a phone
  /// the sheet is a caption for the map and the map is the point; in a
  /// sidebar there is nothing else for the space to be.
  const isPhone = useIsPhone();
  const [openChoice, setOpenChoice] = useState<boolean | null>(null);
  const listOpen = openChoice ?? !isPhone;
  const setListOpen = setOpenChoice;
  /// The scrolling panel itself, so opening a place can return it to the top.
  const sheetRef = useRef<HTMLDivElement>(null);
  // How far the sheet has been dragged from its resting position, in pixels.
  // Non-zero only while a finger is down, so the sheet follows the thumb
  // instead of only responding to a tap on something that looks draggable.
  /// Which of the four counts the list is answering. Cities and countries are
  /// questions about where you have been, and the answer is a list of places
  /// rather than of restaurants — so choosing one shows the groups, and
  /// choosing a group drills into it.
  const [view, setView] = useState<"all" | "been" | "cities" | "countries">("all");
  /// The city or country being looked inside, if any.
  const [drilledInto, setDrilledInto] = useState<string | null>(null);
  /// Whether the share panel for that place is open, and what it currently
  /// covers.
  ///
  /// The map follows it. Deciding what to put in a link is a visual question —
  /// "is that enough of the city" — and answering it from a row of chips while
  /// the map shows something else is guesswork. Turning a category off takes
  /// its pins off the map, so what is on screen is what the person receiving
  /// it will open.
  const [sharing, setSharing] = useState(false);
  const [sharePreview, setSharePreview] = useState<{
    categories: string[];
    statuses: string[];
  } | null>(null);

  const [drag, setDrag] = useState(0);
  const dragFrom = useRef<number | null>(null);

  /// Where the map is looking. Held in state as well as in the ref above,
  /// because the list beside the map now answers "what is here" — and the ref
  /// exists precisely so that panning does *not* re-render, which is the
  /// opposite of what a list following the map needs. The map reports this
  /// when it stops moving, so it is one render per gesture.
  const [bounds, setBounds] = useState<Bounds | null>(null);

  // --- world search, as you type -------------------------------------------
  const trimmedQuery = query.trim();
  const { results, searching } = usePlaceSearch(trimmedQuery, (q, mode) =>
    searchPlaces(q, mode, null, viewport.current),
  );

  const groups = useMemo(() => groupPlaces(places), [places]);

  /// Only while the panel is open — closing it puts the map back.
  const preview = sharing ? sharePreview : null;

  const visiblePlaces = useMemo(
    () =>
      places.filter(
        (p) =>
          (statusFilter === "all" || p.status === statusFilter) &&
          // Been is about where you have actually been, so a wishlist pin is
          // not part of its answer. Cities and Countries are about spread, and
          // hiding the places you have not reached yet would empty them for
          // anybody still planning.
          (view !== "been" || p.status !== "wishlist") &&
          (drilledInto === null || p.city === drilledInto || p.country === drilledInto) &&
          // While a link is being composed, the map shows the link.
          (preview === null ||
            ((preview.categories.length === 0 || preview.categories.includes(p.category)) &&
              (preview.statuses.length === 0 || preview.statuses.includes(p.status)))) &&
          !hidden.has(p.category),
      ),
    [places, statusFilter, hidden, view, drilledInto, preview],
  );

  /// The places the map is currently showing.
  ///
  /// Only while the view is of somewhere in particular. Zoomed out to a
  /// continent there is nothing useful to narrow to, and a list that empties
  /// itself as you zoom out would be a list that breaks when you look for
  /// something.
  ///
  /// Searching turns this off: typing a name means you are looking for it
  /// wherever it is, and hiding the answer because it is off-screen is the
  /// most annoying thing a search can do.
  const inFrame = useMemo(() => {
    if (!bounds || bounds.span > WORLD_SPAN || trimmedQuery.length > 0) return visiblePlaces;
    return visiblePlaces.filter((p) => inView(p, bounds));
  }, [visiblePlaces, bounds, trimmedQuery]);

  const localMatches = useMemo(() => {
    const q = trimmedQuery.toLowerCase();
    if (q.length === 0) return inFrame;
    return inFrame.filter((p) =>
      [p.name, p.city, p.country, p.notes]
        .filter(Boolean)
        .some((field) => field!.toLowerCase().includes(q)),
    );
  }, [inFrame, trimmedQuery]);

  /// Photographs for the places on screen, fetched as you browse.
  ///
  /// Not at save time: most places are never looked at, Wikipedia has nothing
  /// for most of them, and putting a stranger's server in the path of saving
  /// somewhere would make the one action that has to feel instant depend on
  /// it. So the map asks about what it is showing, and pictures appear.
  ///
  /// `asked` is a ref rather than state because it must not cause a render —
  /// it exists to stop a second request going out for a place while the first
  /// is still in the air, and re-rendering on every id added would defeat the
  /// batching it is there to protect.
  const asked = useRef<Set<string>>(new Set());

  /// The places on screen that nobody has looked up yet, as a stable string.
  ///
  /// `inFrame` is a fresh array on most renders, so depending on it re-ran this
  /// whenever the map so much as settled — and each re-run tore down the one
  /// before it. Depending on the ids themselves means it runs when the answer
  /// would actually differ.
  const wantedKey = useMemo(
    () =>
      inFrame
        .filter((p) => !p.photoChecked)
        .map((p) => p.id)
        .sort()
        .join(","),
    [inFrame],
  );

  useEffect(() => {
    const wanted = wantedKey
      .split(",")
      .filter((id) => id && !asked.current.has(id))
      .slice(0, 12);
    if (wanted.length === 0) return;
    for (const id of wanted) asked.current.add(id);

    (async () => {
      try {
        const res = await fetch("/api/places/photos", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ids: wanted }),
        });
        if (!res.ok) return;
        const body = (await res.json()) as {
          places: {
            id: string;
            photoUrl: string | null;
            photoAttribution: string | null;
            photoSourceUrl: string | null;
          }[];
        };
        if (body.places.length === 0) return;
        const byId = new Map(body.places.map((p) => [p.id, p]));
        setPlaces((prev) =>
          prev.map((p) => {
            const found = byId.get(p.id);
            return found ? { ...p, ...found, photoChecked: true } : p;
          }),
        );
      } catch {
        // A place that was asked about and did not come back keeps its tile.
        // Worth retrying on the next visit, which is why nothing is written
        // down as checked here — only the server decides that.
      }
    })();

    // Deliberately nothing to clean up. The obvious version cancelled the
    // request when the effect re-ran, which threw away an answer the server
    // had already found and written down — and `asked` meant it was never
    // asked for again, so the photo simply never appeared. The response is
    // keyed by place id and is the same whenever it lands, so there is no
    // stale answer to protect against.
  }, [wantedKey]);

  /// What to call what is on screen, and the line under it.
  const here = useMemo(() => viewName(inFrame, bounds), [inFrame, bounds]);
  const hereSubtitle = useMemo(
    () => viewSubtitle(inFrame, here, visiblePlaces.length),
    [inFrame, here, visiblePlaces.length],
  );

  const pins = useMemo<MapPin[]>(() => {
    const list: MapPin[] = visiblePlaces.map((p) => {
      const meta = categoryOf(p.category);
      return {
        id: p.id,
        lat: p.lat,
        lng: p.lng,
        color: meta.color,
        icon: placeIconOf(p),
        // Not muted for having been visited. Somewhere you have been is the
        // point of this map, not background to it, and fading most of the pins
        // made them hard to pick out — especially on Apple's paler cartography.
        // The fade is for pins a filter has excluded, which these are not.
        muted: false,
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
  }, [visiblePlaces, draft, categoryOf, placeIconOf]);

  const selected = places.find((p) => p.id === selectedId) ?? null;

  /// Pan the map to one place. A monotonic token, rather than a timestamp,
  /// keeps this pure enough for the React compiler to reason about.
  function panTo(lat: number, lng: number, zoom?: number) {
    setFocus((prev) => ({ lat, lng, zoom, token: (prev?.token ?? 0) + 1 }));
  }

  /// Where to put the map so a whole city is on it.
  ///
  /// A centre is not enough: centring on the middle of Kyoto at a fixed zoom
  /// showed two of its six places and called the view Kyoto anyway. So this
  /// measures how far apart the city's places are and hands back a zoom that
  /// frames them.
  function frameOf(city: string) {
    const here = places.filter((p) => p.city === city);
    if (here.length === 0) return null;

    const lats = here.map((p) => p.lat);
    const lngs = here.map((p) => p.lng);
    const spread = Math.max(
      Math.max(...lats) - Math.min(...lats),
      Math.max(...lngs) - Math.min(...lngs),
    );
    // Half a degree of room around them, and a floor so a single saved place
    // does not zoom to the individual paving stones.
    const span = Math.max(spread * 1.6, 0.02);

    return {
      lat: (Math.max(...lats) + Math.min(...lats)) / 2,
      lng: (Math.max(...lngs) + Math.min(...lngs)) / 2,
      zoom: Math.min(16, Math.max(2, Math.log2(360 / span))),
    };
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

  /// Tapping one of the places Apple already draws on the map.
  ///
  /// The map is full of named restaurants and museums, and until now the only
  /// way to save one was to type its name into the search box while looking
  /// straight at it. Its own label is a better answer than anything a reverse
  /// lookup would guess from the coordinate.
  ///
  /// It opens the same form a dropped pin does, filled in — so it is still a
  /// decision, with a status and a note, rather than a tap that silently adds
  /// something to your map.
  async function selectPlaceOnMap(place: SelectedPlace) {
    setSelectedId(null);
    // Shown at once with what Apple gave us, then filled in with where it is.
    // Waiting on a network round trip before anything appears would make a tap
    // feel like it had missed.
    setDraft({
      name: place.name,
      lat: place.lat,
      lng: place.lng,
      address: null,
      city: null,
      country: null,
      countryCode: null,
      category: place.category,
    });
    const enriched = await enrichSelectedPlace(place);
    setDraft((current) =>
      // Only if they are still looking at the same thing.
      current && current.lat === place.lat && current.lng === place.lng ? enriched : current,
    );
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
        className={`absolute inset-x-0 bottom-0 z-10 flex flex-col gap-3 rounded-t-2xl border-t border-line bg-surface p-3 shadow-2xl lg:static lg:order-1 lg:h-full lg:w-[420px] lg:max-h-none lg:translate-y-0 lg:rounded-none lg:border-t-0 lg:border-r lg:shadow-none ${
          drag ? "" : "transition-[max-height,transform] duration-200"
        } ${listOpen ? "max-h-[78%] overflow-y-auto" : "overflow-visible lg:hidden"} ${
          // On a phone the place card is a sheet over the map, and so is this.
          // Two sheets on top of each other is one sheet nobody can read.
          selected ? "max-lg:hidden" : ""
        }`}
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
              // Against what is on screen rather than against the stored
              // choice, which is null until somebody makes one — and !null is
              // true, so a tap on an open sidebar would have left it open.
              setListOpen(!listOpen);   // a tap
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
              setSelectedId(place.id);
            }}
          />
        ) : (
          <>
            {/* Where the map is looking, and a way to look somewhere else.
                The list under it follows the map, so this menu does not filter
                anything — it moves the map, and the list follows on its own. */}
            <div className={`relative ${listOpen ? "" : "max-sm:block hidden lg:block"}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="display truncate text-3xl leading-tight">
                    {here ?? "Everywhere"}
                  </h2>
                  <p className="mt-0.5 text-xs text-muted">{hereSubtitle}</p>
                </div>
                {/* Shut, the sheet is a caption for the map and the only thing
                    to ask of it is more. Open, it is the list, and the useful
                    question is which city. */}
                {listOpen ? (
                  <button
                    type="button"
                    className="chip shrink-0"
                    aria-haspopup="menu"
                    aria-expanded={citiesOpen}
                    onClick={() => setCitiesOpen((open) => !open)}
                  >
                    Change city
                    <span aria-hidden className="text-[10px]">
                      {citiesOpen ? "▲" : "▼"}
                    </span>
                  </button>
                ) : (
                  <button
                    type="button"
                    className="shrink-0 text-sm font-medium text-accent-text"
                    onClick={() => setListOpen(true)}
                  >
                    See all
                  </button>
                )}
              </div>

              {citiesOpen && (
                <div
                  role="menu"
                  className="card absolute top-full right-0 z-20 mt-1 max-h-80 w-60 overflow-y-auto p-1.5 shadow-lg"
                >
                  {groups.cities.length === 0 && (
                    <p className="px-2 py-1.5 text-xs text-muted">
                      No cities yet — save somewhere and it will be counted here.
                    </p>
                  )}
                  {groups.cities.map((city) => (
                    <button
                      key={city.name}
                      type="button"
                      role="menuitem"
                      className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-foreground/5"
                      aria-label={`${city.name}, ${city.count} ${
                        city.count === 1 ? "place" : "places"
                      }`}
                      onClick={() => {
                        const frame = frameOf(city.name);
                        setCitiesOpen(false);
                        if (frame) panTo(frame.lat, frame.lng, frame.zoom);
                      }}
                    >
                      <span className="min-w-0 flex-1 truncate">{city.name}</span>
                      <span className="shrink-0 text-xs text-muted tabular-nums">
                        {city.count}
                      </span>
                    </button>
                  ))}

                  {/* The counts that used to be four chips across the top.
                      "How many countries have you been to" is answered by
                      naming them, so these still open into lists. */}
                  <div className="mt-1 border-t border-line pt-1">
                    {(
                      [
                        [
                          "cities",
                          `All ${groups.counts.cities} ${groups.counts.cities === 1 ? "city" : "cities"}`,
                        ],
                        [
                          "countries",
                          `All ${groups.counts.countries} ${groups.counts.countries === 1 ? "country" : "countries"}`,
                        ],
                        ["been", `Everywhere you have been (${groups.counts.been})`],
                      ] as const
                    ).map(([id, label]) => (
                      <button
                        key={id}
                        type="button"
                        role="menuitem"
                        className="block w-full rounded-md px-2 py-1.5 text-left text-xs text-accent-text hover:bg-foreground/5"
                        onClick={() => {
                          setView(id);
                          setDrilledInto(null);
                          setCitiesOpen(false);
                          setFitSeq((n) => n + 1);
                        }}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

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
              {/* On a phone this floats on the map rather than sitting in the
                  sheet, which is where the kit puts it and why the map runs
                  to the top of the screen. Fixed rather than absolute: the
                  sheet it is written inside scrolls, and the search must not
                  scroll with it.

                  It exists only below sm — from there up the search lives in
                  the bar across the top. */}
              <div className="fixed inset-x-3 top-[calc(env(safe-area-inset-top)+0.75rem)] z-20 flex items-center gap-2.5 sm:hidden">
                <input
                  className="input glass h-11 flex-1 rounded-full"
                  type="search"
                  value={query}
                  placeholder="Search places or anywhere"
                  onChange={(e) => setQuery(e.target.value)}
                />
                {/* Where "You" lives on a phone now the bar across the top is
                    gone on this screen. */}
                <Link
                  href="/settings"
                  aria-label="You"
                  className="glass grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-full text-sm font-semibold"
                >
                  {user?.image ? (
                    <Image
                      src={user.image}
                      alt=""
                      width={44}
                      height={44}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    (user?.name ?? "?").trim().charAt(0).toUpperCase()
                  )}
                </Link>
              </div>

              {/* Directly under the box, not at the foot of the sidebar. They
                  were last, below every place already saved, so typing
                  something appeared to do nothing until you scrolled past
                  fourteen of your own restaurants to find it had worked. */}
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
                            <PlaceThumb
                              icon={categoryOf(r.category).icon}
                              color={categoryOf(r.category).color}
                              size={32}
                            />
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
              <div
                className={`mt-2 flex items-center justify-between gap-2 ${
                  listOpen ? "" : "max-sm:hidden"
                }`}
              >
                <button
                  type="button"
                  className={`chip ${dropMode ? "is-on" : "sm:hidden"}`}
                  onClick={() => setDropMode(!dropMode)}
                >
                  📌 {dropMode ? "Click the map…" : "Drop a pin"}
                </button>
                <span className="text-xs text-muted">
                  {listOpen ? (
                    <>
                      {wishlistCount} to go ·{" "}
                      {/* The way through to the map of everywhere you have
                          been. It hangs off the count because that is where
                          somebody is already looking when the question occurs
                          to them. */}
                      <Link href="/been" className="text-accent-text hover:underline">
                        {visitedCount} visited
                      </Link>
                    </>
                  ) : (
                    <>{visiblePlaces.length} places — pull up to see them</>
                  )}
                </span>
              </div>

              {/* The peek: the first few of what is in view, as pictures.
                  Shut, the sheet is a caption for the map — what you are
                  looking at, how much of it you have saved, and enough of it
                  to recognise. It used to say "pull up to see them", which
                  named the gesture and nothing else. */}
              {!listOpen && (
                <div className="no-scrollbar -mx-3 mt-3 flex gap-3 overflow-x-auto px-3 pb-1 sm:hidden">
                  {inFrame.length === 0 ? (
                    <p className="py-2 text-xs text-muted">
                      Nothing saved in view. Search above, or drop a pin.
                    </p>
                  ) : (
                    inFrame.slice(0, 10).map((place) => (
                      <button
                        key={place.id}
                        type="button"
                        className="w-[150px] shrink-0 text-left"
                        onClick={() => setSelectedId(place.id)}
                      >
                        <PlaceThumb
                          icon={placeIconOf(place)}
                          color={categoryOf(place.category).color}
                          photoUrl={place.photoUrl}
                          size={104}
                          width={150}
                        />
                        <span className="mt-1.5 block truncate text-sm font-semibold">
                          {place.name}
                        </span>
                        <span className="block truncate text-xs text-muted">
                          {categoryOf(place.category).icon}{" "}
                          {categoryOf(place.category).label}
                        </span>
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>

            {/* One row that scrolls, not three that wrap. Three rows of chips
                pushed the places themselves below the fold on a laptop, so the
                first thing the map showed you was its own controls. Statuses
                first because they are the coarser cut, then the categories. */}
            <div
              // shrink-0 because this is a flex item in a column that
              // overflows, and without it the row gets squeezed — and since
              // setting overflow-x also makes overflow-y clip, the chips were
              // sliced off top and bottom rather than simply being cramped.
              className={`no-scrollbar shrink-0 overflow-x-auto py-1 max-sm:fixed max-sm:inset-x-0 max-sm:top-[calc(env(safe-area-inset-top)+4rem)] max-sm:z-20 max-sm:px-3 sm:-mx-3 sm:px-3 lg:mx-0 lg:px-0 ${
                // Below sm these float on the map and are always up; from
                // there to lg they are inside the sheet, which has to be open
                // for them to have anywhere to be.
                listOpen ? "" : "max-sm:block hidden lg:block"
              }`}
            >
              <div className="flex w-max gap-1.5">
                {[{ id: "all", label: "All", icon: "•" }, ...STATUSES].map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    className={`chip shrink-0 ${statusFilter === s.id ? "is-solid" : ""}`}
                    onClick={() => {
                      setStatusFilter(s.id as typeof statusFilter);
                      setFitSeq((n) => n + 1);
                    }}
                  >
                    {s.id === "all" ? (
                      <span aria-hidden className="text-[10px]">
                        •
                      </span>
                    ) : (
                      <StatusIcon status={s.id} />
                    )}
                    {s.label}
                  </button>
                ))}

                <span aria-hidden className="mx-0.5 w-px shrink-0 self-stretch bg-line" />

                {categories.map((c) => {
                  const on = !hidden.has(c.id);
                  return (
                    <button
                      key={c.id}
                      type="button"
                      aria-pressed={on}
                      className={`chip shrink-0 ${on ? "is-on" : ""}`}
                      style={
                        on
                          ? {
                              borderColor: c.color,
                              background: `color-mix(in srgb, ${c.color} 12%, transparent)`,
                            }
                          : { opacity: 0.5 }
                      }
                      onClick={() =>
                        setHidden((prev) => {
                          const next = new Set(prev);
                          if (next.has(c.id)) next.delete(c.id);
                          else next.add(c.id);
                          return next;
                        })
                      }
                    >
                      {c.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {notice && <p className="text-xs text-muted">{notice}</p>}

            {firstSteps && !firstSteps.hidden && (
              <div className={listOpen ? "" : "hidden lg:block"}>
                <FirstSteps initial={firstSteps} />
              </div>
            )}

            {drilledInto && (
              <div className={`flex items-center gap-3 ${listOpen ? "" : "hidden lg:flex"}`}>
                <button
                  type="button"
                  className="text-left text-xs text-accent-text hover:underline"
                  onClick={() => {
                    setDrilledInto(null);
                    setSharing(false);
                    setFitSeq((n) => n + 1);
                  }}
                >
                  ← Back to all {view === "cities" ? "cities" : "countries"}
                </button>
                {/* The moment somebody is looking at one city is the moment
                    they might want to hand it to a friend who is going. */}
                <button
                  type="button"
                  className="ml-auto text-xs text-accent-text hover:underline"
                  onClick={() => {
                    const next = !sharing;
                    setSharing(next);
                    // A new link covers everywhere you have been, so that is
                    // what the map should show the moment the panel opens.
                    setSharePreview(
                      next ? { categories: [], statuses: ["visited", "lived"] } : null,
                    );
                    setFitSeq((n) => n + 1);
                  }}
                >
                  {sharing ? "Cancel" : `Share ${drilledInto}`}
                </button>
              </div>
            )}

            {drilledInto && sharing && (
              <div className={listOpen ? "" : "hidden lg:block"}>
                <ShareArea
                  area={drilledInto}
                  places={places.filter(
                    (p) => p.city === drilledInto || p.country === drilledInto,
                  )}
                  onPreview={(next) => {
                    setSharePreview(next);
                    setFitSeq((n) => n + 1);
                  }}
                  onClose={() => {
                    setSharing(false);
                    setSharePreview(null);
                    setFitSeq((n) => n + 1);
                  }}
                />
              </div>
            )}

            {(view === "cities" || view === "countries") && !drilledInto ? (
              <section className={`min-h-0 ${listOpen ? "" : "hidden lg:block"}`}>
                <h2 className="mb-1.5 text-xs font-medium tracking-wide text-muted uppercase">
                  {view === "cities" ? "Cities" : "Countries"} on your map
                </h2>
                {(view === "cities" ? groups.cities : groups.countries).length === 0 ? (
                  <p className="card p-3 text-xs text-muted">
                    Mark somewhere &ldquo;Been there&rdquo; and it&apos;ll be
                    counted here.
                  </p>
                ) : (
                  <ul className="divide-y divide-line overflow-hidden rounded-lg border border-line">
                    {(view === "cities" ? groups.cities : groups.countries).map((g) => (
                      <li key={g.name}>
                        <button
                          type="button"
                          className="flex w-full items-center gap-2.5 px-2.5 py-2 text-left hover:bg-foreground/5"
                          onClick={() => {
                            setDrilledInto(g.name);
                            setFitSeq((n) => n + 1);
                          }}
                        >
                          <span aria-hidden className="text-base">
                            {view === "cities" ? "🏙️" : "🌍"}
                          </span>
                          <span className="min-w-0 flex-1 truncate text-sm">{g.name}</span>
                          <span className="shrink-0 text-xs tabular-nums text-muted">
                            {g.count}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            ) : (
            <section className={`min-h-0 ${listOpen ? "" : "hidden lg:block"}`}>
              {/* Collapsible on its own, separately from hiding the whole
                  sidebar. Ninety-two places is a long scroll between the
                  filters above it and anything below, and someone who has just
                  filtered down to a city wants the map, not the list. */}
              <button
                type="button"
                className="mb-1.5 flex w-full items-center gap-1 text-xs font-medium tracking-wide text-muted uppercase hover:text-foreground"
                aria-expanded={placesOpen}
                onClick={() => setPlacesOpen((open) => !open)}
              >
                <span aria-hidden className="text-[10px]">
                  {placesOpen ? "▾" : "▸"}
                </span>
                {drilledInto ?? "Your places"} ({localMatches.length})
              </button>
              {!placesOpen ? null : localMatches.length === 0 ? (
                places.length === 0 ? (
                  // A brand-new account lands on an empty world map. Pasting a
                  // trip you have already taken is by far the fastest way to a
                  // map that feels like yours, so lead with it.
                  <div className="card space-y-3 p-3">
                    <p className="text-sm font-medium">Your map is empty</p>
                    <p className="text-xs text-muted">
                      The quickest start is a list you already have — a note full
                      of places, a spreadsheet, a document. Every place gets found
                      and pinned for you.
                    </p>
                    <Link href="/import" className="btn btn-primary w-full justify-center">
                      Import a list or a file
                    </Link>
                    <Link href="/trips/import" className="btn btn-ghost w-full justify-center">
                      Or build a trip day by day
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
                <ul className="space-y-2">
                  {localMatches.map((p) => {
                    const meta = categoryOf(p.category);
                    const chosen = p.id === selectedId;
                    // Category label first, then whatever was written about the
                    // place. The city is the fallback rather than the default:
                    // in a list already scoped to somewhere, "Lisbon, Portugal"
                    // on every row says nothing.
                    const under =
                      [meta.label, p.notes?.trim()].filter(Boolean).join(" · ") ||
                      [p.city, p.country].filter(Boolean).join(", ");
                    return (
                      <li key={p.id}>
                        <button
                          type="button"
                          aria-current={chosen ? "true" : undefined}
                          className={`flex w-full items-center gap-3 rounded-[18px] border p-2.5 text-left transition-colors ${
                            chosen
                              ? "border-accent bg-accent/5"
                              : "border-line bg-surface hover:border-accent/40"
                          }`}
                          onClick={() => {
                            setSelectedId(p.id);
                            panTo(p.lat, p.lng);
                          }}
                        >
                          {/* Wikipedia's photograph when there is one, and the
                              category's tile when there is not — which is most
                              of the time, since a place nobody has been to has
                              no photo of its own. */}
                          <PlaceThumb
                            photoUrl={p.photoUrl}
                            icon={placeIconOf(p)}
                            color={meta.color}
                            size={52}
                          />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-semibold">
                              {p.name}
                            </span>
                            <span className="block truncate text-xs text-muted">{under}</span>
                            {p.rating ? (
                              <Stars value={p.rating} />
                            ) : null}
                          </span>
                          <span
                            aria-label={statusOf(p.status).label}
                            title={statusOf(p.status).label}
                            className={`shrink-0 self-start ${
                              p.status === "wishlist" ? "text-accent-text" : "text-muted"
                            }`}
                          >
                            <StatusIcon status={p.status} className="h-4 w-4" />
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
            )}

          </>
        )}
      </aside>

      {/* `relative` on large screens as well: below lg this is absolute and
          already a containing block, but at lg it goes back into flow, and
          anything positioned inside it — Otto — would otherwise escape to the
          page and land on top of the list. */}
      <div className="absolute inset-0 lg:relative lg:order-2 lg:min-h-0 lg:flex-1">
        {!listOpen && (
          <button
            type="button"
            className="card absolute top-3 left-3 z-10 hidden px-3 py-1.5 text-xs font-medium shadow-lg lg:block"
            onClick={() => setListOpen(true)}
          >
            ☰ Your places ({visiblePlaces.length})
          </button>
        )}
        {/* The place, floating over the map rather than replacing the list —
            which is where the boards put it, and it means you can still see
            what else is nearby while you read about one thing.

            Below lg it is a sheet over the map instead, and the list hides
            itself, because a 372px card floating on a phone is just a card
            with no room around it. */}
        {selected && (
          <div
            className="absolute inset-x-0 bottom-0 z-20 max-h-[80%] overflow-y-auto rounded-t-2xl border-t border-line bg-surface p-4 shadow-2xl lg:inset-x-auto lg:top-6 lg:right-6 lg:bottom-auto lg:max-h-[calc(100%-3rem)] lg:w-[372px] lg:rounded-3xl lg:border"
          >
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
          </div>
        )}

        <MapCanvas
          pins={pins}
          selectedId={draft ? DRAFT_PIN_ID : selectedId}
          onViewport={(view) => {
            // Only while looking at somewhere in particular. Roughly a country
            // across; wider than that and the centre of the view is a point in
            // the ocean that no one is thinking about.
            viewport.current =
              view.span <= 8 ? { lat: view.lat, lng: view.lng } : null;
            setBounds({
              north: view.north,
              south: view.south,
              east: view.east,
              west: view.west,
              span: view.span,
            });
          }}
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
          onPlaceSelect={(place) => void selectPlaceOnMap(place)}
        />
        {dropMode && (
          <div className="pointer-events-none absolute inset-x-0 top-3 flex justify-center">
            <p className="card px-3 py-1.5 text-xs shadow-lg">
              Click anywhere on the map to drop a pin
            </p>
          </div>
        )}
        {/* Where the app opens, because the place he actually works is a day
            with nothing on it and nobody opens one of those on purpose.
            Hidden while dropping a pin: the map is being aimed at. */}
        {otto && !dropMode && <OttoIntro />}
      </div>
    </div>
  );
}
