import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/user";
import { flagEmoji } from "@/lib/geo";
import { BEEN_STATUSES } from "@/lib/taxonomy";
import { formatDay } from "@/lib/trips";
import { serializePlace } from "@/lib/types";
import BeenMap from "@/components/BeenMap";
import StarRating from "@/components/StarRating";

export const dynamic = "force-dynamic";

export default async function BeenPage() {
  const user = await requireUser();
  const visited = await prisma.place.findMany({
    // Somewhere you lived is somewhere you have been.
    where: { userId: user.id, status: { in: [...BEEN_STATUSES] } },
    orderBy: [{ visitedAt: "desc" }, { createdAt: "desc" }],
  });

  const countries = new Map<string, { name: string; code: string | null; count: number }>();
  const cities = new Set<string>();

  for (const place of visited) {
    if (place.city) cities.add(`${place.city}|${place.countryCode ?? ""}`);
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

  const ranked = [...countries.values()].sort((a, b) => b.count - a.count);

  const livedCount = visited.filter((p) => p.status === "lived").length;

  const stats = [
    { label: "Places", value: visited.length },
    ...(livedCount > 0 ? [{ label: "Lived", value: livedCount }] : []),
    { label: "Cities", value: cities.size },
    { label: "Countries", value: countries.size },
  ];

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="text-xl font-semibold">Everywhere you&apos;ve been</h1>
      <p className="mt-1 text-sm text-muted">
        Everywhere marked <span aria-hidden>✅</span> Been there or{" "}
        <span aria-hidden>🏠</span> Lived there.
      </p>

      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="card px-4 py-3">
            <p className="text-2xl font-semibold tabular-nums">{s.value}</p>
            <p className="text-xs text-muted">{s.label}</p>
          </div>
        ))}
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
            <BeenMap places={visited.map(serializePlace)} />
          </div>

          <h2 className="mt-8 mb-2 text-sm font-medium">By country</h2>
          <ul className="flex flex-wrap gap-2">
            {ranked.map((c) => (
              <li key={c.name} className="card px-3 py-1.5 text-sm">
                <span aria-hidden className="mr-1.5">
                  {flagEmoji(c.code)}
                </span>
                {c.name}
                <span className="ml-2 text-xs text-muted tabular-nums">{c.count}</span>
              </li>
            ))}
          </ul>

          <h2 className="mt-8 mb-2 text-sm font-medium">Recently visited</h2>
          <ul className="card divide-y divide-line overflow-hidden">
            {visited.slice(0, 25).map((place) => (
              <li key={place.id}>
                <Link
                  href={`/?place=${place.id}`}
                  className="flex items-center gap-3 px-3 py-2.5 transition-colors hover:bg-foreground/5"
                >
                  <span aria-hidden>{flagEmoji(place.countryCode)}</span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{place.name}</p>
                    <p className="truncate text-xs text-muted">
                      {[place.city, place.country].filter(Boolean).join(", ")}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    <StarRating value={place.rating} size="sm" />
                    {place.visitedAt && (
                      <span className="text-xs text-muted tabular-nums">
                        {formatDay(place.visitedAt, {
                          weekday: undefined,
                          year: "numeric",
                        })}
                      </span>
                    )}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
