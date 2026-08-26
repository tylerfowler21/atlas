import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/user";
import { flagEmoji } from "@/lib/geo";

export const metadata: Metadata = { title: "Journal — Roava" };
export const dynamic = "force-dynamic";

/// Everything written down, newest first — the record rather than the map.
export default async function JournalPage() {
  const user = await requireUser();

  const memories = await prisma.memory.findMany({
    where: { userId: user.id },
    orderBy: [{ happenedOn: "desc" }, { createdAt: "desc" }],
    take: 300,
    include: {
      place: { select: { id: true, name: true, city: true, country: true, countryCode: true } },
      trip: { select: { id: true, title: true } },
      photos: { select: { id: true }, orderBy: { createdAt: "asc" } },
    },
  });

  // Grouped by year, which is how people look back on their own life rather
  // than by an undifferentiated scroll.
  const byYear = new Map<string, typeof memories>();
  for (const m of memories) {
    const year = String(new Date(m.happenedOn ?? m.createdAt).getUTCFullYear());
    const bucket = byYear.get(year);
    if (bucket) bucket.push(m);
    else byYear.set(year, [m]);
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="text-xl font-semibold">Journal</h1>
      <p className="mt-1 text-sm text-muted">
        Everything you&apos;ve written down, newest first. Entries are private —
        publishing a trip never publishes these.
      </p>

      {memories.length === 0 ? (
        <p className="mt-8 text-sm text-muted">
          Nothing written yet. Open a place on the{" "}
          <Link href="/" className="text-accent-text underline">
            map
          </Link>{" "}
          and choose <span className="font-medium">Memories &amp; journal</span>.
        </p>
      ) : (
        <div className="mt-8 space-y-8">
          {[...byYear.entries()].map(([year, entries]) => (
            <section key={year}>
              <h2 className="mb-2 text-sm font-medium text-muted">{year}</h2>
              <ul className="space-y-3">
                {entries.map((m) => (
                  <li key={m.id} className="card p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        {m.title && <p className="text-sm font-medium">{m.title}</p>}
                        <p className="text-xs text-muted">
                          {new Date(m.happenedOn ?? m.createdAt).toLocaleDateString(
                            undefined,
                            {
                              timeZone: m.happenedOn ? "UTC" : undefined,
                              day: "numeric",
                              month: "long",
                            },
                          )}
                          {m.place && (
                            <>
                              {" · "}
                              {flagEmoji(m.place.countryCode)}{" "}
                              <Link href={`/?place=${m.place.id}`} className="text-accent-text hover:underline">
                                {m.place.name}
                              </Link>
                            </>
                          )}
                          {m.trip && (
                            <>
                              {" · "}
                              <Link href={`/trips/${m.trip.id}`} className="text-accent-text hover:underline">
                                {m.trip.title}
                              </Link>
                            </>
                          )}
                        </p>
                      </div>
                    </div>
                    {m.body && (
                      <p className="mt-2 text-sm whitespace-pre-wrap">{m.body}</p>
                    )}

                    {m.photos.length > 0 && (
                      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
                        {m.photos.map((photo) => (
                          <a
                            key={photo.id}
                            href={`/api/photos/${photo.id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="block overflow-hidden rounded-lg border border-line"
                          >
                            {/* Streamed through the app after an ownership check,
                                so there is no public URL for next/image to use. */}
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={`/api/photos/${photo.id}`}
                              alt=""
                              loading="lazy"
                              className="aspect-square w-full object-cover"
                            />
                          </a>
                        ))}
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
