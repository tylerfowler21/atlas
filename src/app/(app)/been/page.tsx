import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/user";
import { flagEmoji } from "@/lib/geo";
import { BEEN_STATUSES, placeIcon } from "@/lib/taxonomy";
import { formatDay } from "@/lib/trips";
import { serializePlace } from "@/lib/types";
import BeenMap from "@/components/BeenMap";
import StarRating from "@/components/StarRating";

export const metadata: Metadata = { title: "Been — Roava" };
export const dynamic = "force-dynamic";

type View = "all" | "lived" | "cities" | "countries";

const VIEWS = new Set<View>(["all", "lived", "cities", "countries"]);

/// The period you lived somewhere, as a person would say it.
function livedRange(from: Date | null, to: Date | null) {
  const year = (d: Date) => d.getUTCFullYear();
  if (!from && !to) return "Lived here";
  if (from && !to) return `Since ${year(from)}`;
  if (!from && to) return `Until ${year(to)}`;
  return year(from!) === year(to!) ? `${year(from!)}` : `${year(from!)}–${year(to!)}`;
}

export default async function BeenPage({
  searchParams,
}: {
  searchParams: Promise<{ show?: string }>;
}) {
  const user = await requireUser();
  const { show } = await searchParams;
  const view: View = VIEWS.has(show as View) ? (show as View) : "all";

  const visited = await prisma.place.findMany({
    // Somewhere you lived is somewhere you have been.
    where: { userId: user.id, status: { in: [...BEEN_STATUSES] } },
    orderBy: [{ visitedAt: "desc" }, { createdAt: "desc" }],
  });

  const countries = new Map<string, { name: string; code: string | null; count: number }>();
  const cityCounts = new Map<string, { city: string; code: string | null; count: number }>();

  for (const place of visited) {
    if (place.city) {
      const key = `${place.city}|${place.countryCode ?? ""}`;
      const entry = cityCounts.get(key);
      if (entry) entry.count += 1;
      else cityCounts.set(key, { city: place.city, code: place.countryCode, count: 1 });
    }
    const key = place.countryCode ?? place.country ?? "unknown";
    const entry = countries.get(key);
    if (entry) entry.count += 1;
    else
      countries.set(key, {
        name: place.country ?? "Somewhere",
        code: place.countryCode,
        count: 1,
      });
  }

  const rankedCountries = [...countries.values()].sort((a, b) => b.count - a.count);
  const rankedCities = [...cityCounts.values()].sort((a, b) => b.count - a.count);
  const lived = visited.filter((p) => p.status === "lived");

  // Each tile is a view of the same data rather than a number you can only read.
  const tiles: { view: View; label: string; value: number }[] = [
    { view: "all", label: "Places", value: visited.length },
    ...(lived.length > 0
      ? [{ view: "lived" as View, label: "Lived", value: lived.length }]
      : []),
    { view: "cities", label: "Cities", value: cityCounts.size },
    { view: "countries", label: "Countries", value: countries.size },
  ];

  // The map follows the filter where the filter is a set of places.
  const onMap = view === "lived" ? lived : visited;
  const listed = view === "lived" ? lived : visited;

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="text-xl font-semibold">Everywhere you&apos;ve been</h1>
      <p className="mt-1 text-sm text-muted">
        Everywhere marked <span aria-hidden>✅</span> Been there or{" "}
        <span aria-hidden>🏠</span> Lived there. Tap a number to see what&apos;s
        behind it.
      </p>

      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {tiles.map((t) => {
          const active = view === t.view;
          return (
            <Link
              key={t.label}
              href={t.view === "all" ? "/been" : `/been?show=${t.view}`}
              aria-current={active ? "page" : undefined}
              className={`card px-4 py-3 transition-colors ${
                active ? "border-accent bg-accent/10" : "hover:bg-foreground/5"
              }`}
            >
              <p className="text-2xl font-semibold tabular-nums">{t.value}</p>
              <p className={`text-xs ${active ? "text-accent" : "text-muted"}`}>{t.label}</p>
            </Link>
          );
        })}
      </div>

      {visited.length === 0 ? (
        <p className="mt-10 text-sm text-muted">
          Nothing marked as visited yet. Open a place on the{" "}
          <Link href="/" className="text-accent underline">
            map
          </Link>{" "}
          and switch it to “Been there”.
        </p>
      ) : (
        <>
          <div className="mt-6">
            <BeenMap
              // Remounts when the filter changes so the map refits to what is
              // actually shown rather than keeping the old viewport.
              key={view}
              places={onMap.map(serializePlace)}
            />
          </div>

          {view === "countries" && (
            <>
              <h2 className="mt-8 mb-2 text-sm font-medium">
                {rankedCountries.length} countries
              </h2>
              <ul className="card divide-y divide-line overflow-hidden">
                {rankedCountries.map((c) => (
                  <li key={c.name} className="flex items-center gap-3 px-3 py-2.5">
                    <span aria-hidden>{flagEmoji(c.code)}</span>
                    <span className="min-w-0 flex-1 truncate text-sm">{c.name}</span>
                    <span className="text-xs text-muted tabular-nums">
                      {c.count} {c.count === 1 ? "place" : "places"}
                    </span>
                  </li>
                ))}
              </ul>
            </>
          )}

          {view === "cities" && (
            <>
              <h2 className="mt-8 mb-2 text-sm font-medium">
                {rankedCities.length} cities
              </h2>
              <ul className="card divide-y divide-line overflow-hidden">
                {rankedCities.map((c) => (
                  <li key={`${c.city}-${c.code}`} className="flex items-center gap-3 px-3 py-2.5">
                    <span aria-hidden>{flagEmoji(c.code)}</span>
                    <span className="min-w-0 flex-1 truncate text-sm">{c.city}</span>
                    <span className="text-xs text-muted tabular-nums">
                      {c.count} {c.count === 1 ? "place" : "places"}
                    </span>
                  </li>
                ))}
              </ul>
            </>
          )}

          {(view === "all" || view === "lived") && (
            <>
              <h2 className="mt-8 mb-2 text-sm font-medium">
                {view === "lived"
                  ? `${lived.length} ${lived.length === 1 ? "place" : "places"} you've lived`
                  : "Recently visited"}
              </h2>
              <ul className="card divide-y divide-line overflow-hidden">
                {(view === "lived" ? listed : listed.slice(0, 25)).map((place) => (
                  <li key={place.id}>
                    <Link
                      href={`/?place=${place.id}`}
                      className="flex items-center gap-3 px-3 py-2.5 transition-colors hover:bg-foreground/5"
                    >
                      <span aria-hidden>{placeIcon(place)}</span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{place.name}</p>
                        <p className="truncate text-xs text-muted">
                          {flagEmoji(place.countryCode)}{" "}
                          {[place.city, place.country].filter(Boolean).join(", ")}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-3">
                        <StarRating value={place.rating} size="sm" />
                        <span className="text-xs text-muted tabular-nums">
                          {place.status === "lived"
                            ? livedRange(place.livedFrom, place.livedTo)
                            : place.visitedAt
                              ? formatDay(place.visitedAt, {
                                  weekday: undefined,
                                  year: "numeric",
                                })
                              : ""}
                        </span>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            </>
          )}
        </>
      )}
    </div>
  );
}
