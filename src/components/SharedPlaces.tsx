"use client";

import { useMemo, useState } from "react";
import MapCanvas, { type MapPin } from "@/components/MapCanvas";
import DirectionsIcon from "@/components/DirectionsIcon";
import { directionsUrl } from "@/lib/directions";
import { category as resolve, placeIcon, type Category } from "@/lib/taxonomy";
import { placeName } from "@/lib/place-name";
import type { PublicPlaceDTO } from "@/lib/types";

/// Somebody else's places in one city, read-only.
///
/// Grouped by category rather than listed flat, because the question this
/// answers is "where should I eat" — you arrive looking for one kind of thing,
/// not for a list of everywhere.
export default function SharedPlaces({
  area,
  note,
  author,
  places,
  categories = [],
}: {
  area: string;
  note: string | null;
  author: string | null;
  places: PublicPlaceDTO[];
  /// The author's own categories, since these are their labels and colours.
  categories?: Category[];
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const categoryOf = useMemo(
    () => (id: string) => resolve(id, categories),
    [categories],
  );

  /// In the order the categories themselves are in, so a guide always reads
  /// the same way round rather than by whichever group happens to be biggest.
  const groups = useMemo(() => {
    const byCategory = new Map<string, PublicPlaceDTO[]>();
    for (const place of places) {
      byCategory.set(place.category, [...(byCategory.get(place.category) ?? []), place]);
    }
    return [...byCategory.entries()].map(([id, list]) => ({
      category: categoryOf(id),
      places: list,
    }));
  }, [places, categoryOf]);

  const pins = useMemo<MapPin[]>(
    () =>
      places.map((p) => ({
        id: p.id,
        lat: p.lat,
        lng: p.lng,
        color: categoryOf(p.category).color,
        icon: placeIcon(p, categories),
      })),
    [places, categoryOf, categories],
  );

  return (
    <div className="flex flex-col lg:h-full lg:flex-row">
      <aside className="flex w-full shrink-0 flex-col gap-4 border-b border-line p-4 lg:h-full lg:w-[26rem] lg:overflow-y-auto lg:border-r lg:border-b-0">
        <div>
          <p className="text-xs tracking-wide text-muted uppercase">
            {author ? `${author}'s ${area}` : area}
          </p>
          <h1 className="mt-1 text-lg font-semibold">{area}</h1>
          <p className="mt-1 text-xs text-muted">
            {places.length} {places.length === 1 ? "place" : "places"}
          </p>
          {note && <p className="mt-3 text-sm">{note}</p>}
        </div>

        {places.length === 0 ? (
          <p className="card p-3 text-sm text-muted">
            Nothing here yet.
          </p>
        ) : (
          groups.map(({ category, places: list }) => (
            <section key={category.id}>
              <h2 className="mb-1.5 flex items-center gap-1.5 text-xs font-medium tracking-wide text-muted uppercase">
                <span aria-hidden>{category.icon}</span>
                {category.label}
                <span className="tabular-nums">({list.length})</span>
              </h2>
              <ul className="divide-y divide-line overflow-hidden rounded-lg border border-line">
                {list.map((p) => (
                  <li key={p.id} className="flex items-center">
                    <button
                      type="button"
                      className={`flex min-w-0 flex-1 items-center gap-2.5 px-2.5 py-2 text-left hover:bg-foreground/5 ${
                        selectedId === p.id ? "bg-foreground/5" : ""
                      }`}
                      onClick={() => setSelectedId(p.id)}
                    >
                      <span
                        aria-hidden
                        className="grid size-7 shrink-0 place-items-center rounded-full text-xs"
                        style={{ background: `${category.color}22` }}
                      >
                        {placeIcon(p, categories)}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm">{placeName(p)}</span>
                        <span className="block truncate text-xs text-muted">
                          {p.city ?? p.country ?? ""}
                        </span>
                      </span>
                    </button>
                    <a
                      href={directionsUrl({ lat: p.lat, lng: p.lng })}
                      target="_blank"
                      rel="noreferrer"
                      className="shrink-0 px-2.5 py-2"
                      aria-label={`Directions to ${placeName(p)}`}
                    >
                      <DirectionsIcon size={20} />
                    </a>
                  </li>
                ))}
              </ul>
            </section>
          ))
        )}

        <p className="mt-auto border-t border-line pt-3 text-xs text-muted">
          Shared with you from Roava · read-only
        </p>
      </aside>

      <div className="relative h-[55vh] lg:h-auto lg:min-h-0 lg:flex-1">
        <MapCanvas
          // Public traffic, so never the Apple quota — the same reasoning as a
          // shared itinerary.
          basemap="free"
          pins={pins}
          selectedId={selectedId}
          onSelect={setSelectedId}
          fitToken={`shared-places-${area}`}
        />
      </div>
    </div>
  );
}
