"use client";

import { useCallback, useMemo, useState } from "react";
import DirectionsIcon from "@/components/DirectionsIcon";
import MapCanvas, { type MapPin } from "@/components/MapCanvas";
import { category as resolve, stopIcon, travelMode, type Category } from "@/lib/taxonomy";
import { dateForDay, dayCount, formatDay, formatRange } from "@/lib/trips";
import { directionsUrl } from "@/lib/directions";
import type { PublicItemDTO, PublicTripDTO } from "@/lib/types";

/// The read-only twin of TripPlanner, rendered for anyone holding a share
/// link. Same day tabs and same map, but nothing that writes.
export default function SharedTrip({
  trip,
  items,
  categories = [],
}: {
  trip: PublicTripDTO;
  items: PublicItemDTO[];
  /// The categories this trip's own stops use, sent with the page.
  ///
  /// Whoever is reading a shared itinerary is not signed in as the person who
  /// wrote it, and may not be signed in at all, so their own categories are no
  /// help. Without these, a stop filed under one somebody invented would
  /// quietly show as Other to everybody but its author.
  categories?: Category[];
}) {
  const categoryOf = useCallback((id: string) => resolve(id, categories), [categories]);
  const stopIconOf = useCallback(
    (item: Parameters<typeof stopIcon>[0]) => stopIcon(item, categories),
    [categories],
  );
  const [activeDay, setActiveDay] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const days = dayCount(trip, items);

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
          icon: stopIconOf(item),
          badge: badge ? String(badge) : null,
          muted: !badge,
        };
      });
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

  const dayDate = dateForDay(trip, activeDay);

  return (
    // Natural height on a phone, so the page scrolls and the map below the
    // itinerary can actually be reached. Full height and two columns only from
    // lg up, where both fit at once.
    <div className="flex flex-col lg:h-full lg:flex-row">
      <aside className="flex w-full shrink-0 flex-col gap-4 border-b border-line p-4 lg:h-full lg:w-[26rem] lg:overflow-y-auto lg:border-r lg:border-b-0">
        <div>
          <p className="text-xs tracking-wide text-muted uppercase">Shared itinerary</p>
          <h1 className="mt-1 flex items-center gap-2 text-lg font-semibold">
            <span
              aria-hidden
              className="size-3 shrink-0 rounded-full"
              style={{ background: trip.color }}
            />
            {trip.title}
          </h1>
          <p className="text-xs text-muted">
            {[trip.destination, formatRange(trip)].filter(Boolean).join(" · ")}
          </p>
        </div>

        {days > 1 && (
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
                  {date
                    ? formatDay(date, { month: undefined, day: undefined })
                    : `Day ${i + 1}`}
                  <span className="text-muted">{i + 1}</span>
                </button>
              );
            })}
          </div>
        )}

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
            <p className="mt-2 text-xs text-muted">Nothing planned for this day.</p>
          ) : (
            <ol className="mt-2 space-y-2">
              {dayItems.map((item, index) => {
                const meta = categoryOf(item.category);
                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedId(item.id)}
                      className={`card flex w-full items-start gap-2.5 p-2.5 text-left transition-shadow ${
                        selectedId === item.id ? "ring-2 ring-accent" : ""
                      }`}
                    >
                      <span
                        aria-hidden
                        className="grid size-7 shrink-0 place-items-center rounded-full text-xs font-semibold text-white"
                        style={{ background: trip.color }}
                      >
                        {index + 1}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-medium">{item.title}</span>
                        <span className="block truncate text-xs text-muted">
                          {stopIconOf(item)}{" "}
                          {item.kind === "travel"
                            ? `${travelMode(item.mode).label}${
                                item.place && item.toPlace
                                  ? ` · ${item.place.name} → ${item.toPlace.name}`
                                  : ""
                              }${
                                item.startTime && item.endTime
                                  ? ` · ${item.startTime}–${item.endTime}`
                                  : ""
                              }`
                            : `${meta.label}${item.place?.city ? ` · ${item.place.city}` : ""}`}
                        </span>
                        {item.notes && (
                          <span className="mt-1 block text-xs text-muted">
                            {item.notes}
                          </span>
                        )}
                      </span>
                      {item.startTime && (
                        <span className="shrink-0 text-xs text-muted tabular-nums">
                          {item.startTime}
                        </span>
                      )}
                    </button>
                    {item.place && (
                      <a
                        href={directionsUrl({
                          lat: item.place.lat,
                          lng: item.place.lng,
                          name: item.place.name,
                        })}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-1 ml-10 inline-flex items-center gap-1 text-xs text-accent-text hover:underline"
                      >
                        <DirectionsIcon />
                        Directions
                      </a>
                    )}
                  </li>
                );
              })}
            </ol>
          )}
        </div>

        <p className="mt-auto border-t border-line pt-3 text-xs text-muted">
          Shared with you from Roava · read-only
        </p>
      </aside>

      {/* A real height, not a minimum.
          The map fills its box with height:100%, and a percentage height needs
          a parent with a definite height to resolve against. With only a
          min-height it resolved to nothing, the map collapsed to zero, and a
          phone showed a blank band where the map should be — while a laptop was
          fine, because there the row supplies a real height. */}
      <div className="relative h-[55vh] lg:h-auto lg:min-h-0 lg:flex-1">
        <MapCanvas
          // A shared itinerary is readable with no account, so this map is
          // shown to strangers and crawlers. Keeping it on the free basemap
          // means public traffic can never exhaust the Apple quota and take
          // the map down for everyone.
          basemap="free"
          pins={pins}
          route={route}
          legs={legs}
          routeColor={trip.color}
          selectedId={selectedId}
          onSelect={setSelectedId}
          fitToken={`shared-${activeDay}`}
        />
      </div>
    </div>
  );
}
