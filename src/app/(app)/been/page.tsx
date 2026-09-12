import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/user";
import { flagEmoji } from "@/lib/geo";
import { beenYears, summarise, tripsInYear, inYear } from "@/lib/been";
import { beenPlaces } from "@/lib/place-groups";
import DotWorld from "@/components/DotWorld";

export const metadata: Metadata = { title: "Been — Roava" };
export const dynamic = "force-dynamic";

/// A month and year, for under a city's name.
const WHEN = new Intl.DateTimeFormat("en", { month: "short", year: "numeric" });

/// Everywhere you have been, as a picture rather than a list.
///
/// This address used to redirect to the map with the Been filter on, which
/// answered the question by showing you the same map again. The question
/// people actually ask of a travel app — how much of the world have I seen —
/// wants a number and a shape, not pins.
export default async function BeenPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string }>;
}) {
  const user = await requireUser();
  const { year: yearParam } = await searchParams;

  const [places, trips] = await Promise.all([
    prisma.place.findMany({
      where: { userId: user.id },
      select: {
        id: true,
        name: true,
        status: true,
        city: true,
        country: true,
        countryCode: true,
        visitedAt: true,
        photoUrl: true,
      },
      orderBy: { visitedAt: "desc" },
    }),
    prisma.trip.findMany({
      where: { userId: user.id },
      select: { startDate: true, endDate: true },
    }),
  ]);

  const years = beenYears(places);
  // A year in the address that you have nothing in is not an error worth a
  // page of its own — it is a stale link, and all time is the honest answer.
  const chosen = years.find((y) => String(y) === yearParam) ?? null;

  const stats = summarise(places, chosen);
  const tripCount = tripsInYear(
    trips.map((t) => ({
      startDate: t.startDate?.toISOString() ?? null,
      endDate: t.endDate?.toISOString() ?? null,
    })),
    chosen,
  );

  /// One card per city, newest first — a city is the unit people remember a
  /// trip in, and eight cards for eight restaurants in Lisbon is a worse
  /// answer than one that says Lisbon.
  const recent: {
    city: string;
    country: string | null;
    countryCode: string | null;
    when: Date | null;
    photoUrl: string | null;
  }[] = [];
  const seen = new Set<string>();
  for (const place of inYear(beenPlaces(places), chosen)) {
    const city = place.city?.trim();
    if (!city) continue;
    const key = `${city}, ${place.country ?? ""}`;
    if (seen.has(key)) {
      // A city already carded takes the first photograph that turns up for it.
      const card = recent.find((r) => `${r.city}, ${r.country ?? ""}` === key);
      if (card && !card.photoUrl && place.photoUrl) card.photoUrl = place.photoUrl;
      continue;
    }
    seen.add(key);
    recent.push({
      city,
      country: place.country,
      countryCode: place.countryCode,
      when: place.visitedAt,
      photoUrl: place.photoUrl,
    });
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:py-8">
      <Link href="/" className="text-sm text-muted hover:underline">
        ‹ Map
      </Link>

      <p className="mt-4 text-sm text-muted">
        {user.name ? `${user.name} has been to` : "You have been to"}
      </p>
      <h1 className="font-display text-4xl leading-none tracking-tight sm:text-6xl">
        <span className="text-accent-text">{stats.countries}</span>{" "}
        {stats.countries === 1 ? "country" : "countries"}
      </h1>

      <p className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-sm text-muted">
        <span>
          <b className="text-ink">{stats.cities}</b>{" "}
          {stats.cities === 1 ? "city" : "cities"}
        </span>
        <span>
          <b className="text-ink">{stats.places}</b>{" "}
          {stats.places === 1 ? "place" : "places"}
        </span>
        <span>
          <b className="text-ink">{tripCount}</b>{" "}
          {tripCount === 1 ? "trip" : "trips"}
        </span>
      </p>

      {years.length > 0 && (
        <nav className="no-scrollbar -mx-4 mt-5 flex gap-2 overflow-x-auto px-4">
          <YearChip href="/been" on={chosen === null}>
            All time
          </YearChip>
          {years.map((year) => (
            <YearChip key={year} href={`/been?year=${year}`} on={chosen === year}>
              {String(year)}
            </YearChip>
          ))}
        </nav>
      )}

      <div className="card mt-5 p-4 sm:p-6">
        <DotWorld countryCodes={stats.countryCodes} className="w-full" />
      </div>

      <div className="mt-8 flex items-baseline justify-between">
        <h2 className="font-display text-2xl tracking-tight">Recently</h2>
        <Link href="/?status=visited" className="text-sm font-medium text-accent-text">
          See all
        </Link>
      </div>

      {recent.length === 0 ? (
        <p className="mt-3 text-sm text-muted">
          Nothing marked as been there yet. Mark a place you have been and it
          will light up on the map above.
        </p>
      ) : (
        <ul className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {recent.slice(0, 9).map((card) => (
            <li
              key={`${card.city}, ${card.country ?? ""}`}
              className="relative aspect-[4/3] overflow-hidden rounded-2xl bg-brand-surface"
            >
              {card.photoUrl ? (
                <Image
                  src={card.photoUrl}
                  alt=""
                  fill
                  sizes="(min-width: 640px) 220px, 45vw"
                  className="object-cover"
                />
              ) : (
                // No photograph yet. The flag rather than a grey box: it says
                // which country this was without pretending to be a picture
                // of it.
                <span className="absolute inset-0 grid place-items-center text-4xl">
                  {flagEmoji(card.countryCode)}
                </span>
              )}

              {/* Dark at the foot, where the name sits, and nowhere else — the
                  photograph is the point of the card. */}
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 to-transparent p-2.5 pt-8">
                <p className="text-sm font-semibold text-white">{card.city}</p>
                <p className="text-xs text-white/80">
                  {[card.country, card.when ? WHEN.format(card.when) : null]
                    .filter(Boolean)
                    .join(", ")}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function YearChip({
  href,
  on,
  children,
}: {
  href: string;
  on: boolean;
  children: string;
}) {
  return (
    <Link href={href} className={`chip shrink-0 ${on ? "is-on" : ""}`} scroll={false}>
      {children}
    </Link>
  );
}
