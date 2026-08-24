import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/user";
import { category as categoryOf } from "@/lib/taxonomy";
import { flagEmoji } from "@/lib/geo";
import StarRating from "@/components/StarRating";

export const dynamic = "force-dynamic";

export default async function PlacesPage() {
  const user = await getCurrentUser();
  const places = await prisma.place.findMany({
    where: { userId: user.id },
    orderBy: [{ country: "asc" }, { city: "asc" }, { name: "asc" }],
  });

  // Group by city so the list reads like a travel notebook rather than a table.
  const groups = new Map<string, typeof places>();
  for (const place of places) {
    const key = [place.city, place.country].filter(Boolean).join(", ") || "Unplaced";
    const bucket = groups.get(key);
    if (bucket) bucket.push(place);
    else groups.set(key, [place]);
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold">Places</h1>
          <p className="mt-1 text-sm text-muted">
            {places.length} saved across {groups.size}{" "}
            {groups.size === 1 ? "place" : "places"}
          </p>
        </div>
        <Link href="/" className="btn btn-primary">
          Add on the map
        </Link>
      </div>

      {places.length === 0 ? (
        <p className="mt-10 text-sm text-muted">
          Nothing saved yet.{" "}
          <Link href="/" className="text-accent underline">
            Open the map
          </Link>{" "}
          and search for somewhere you want to go.
        </p>
      ) : (
        <div className="mt-8 space-y-8">
          {[...groups.entries()].map(([label, group]) => (
            <section key={label}>
              <h2 className="mb-2 text-sm font-medium">
                {flagEmoji(group[0]!.countryCode)} {label}
                <span className="ml-2 text-xs font-normal text-muted">
                  {group.length}
                </span>
              </h2>
              <ul className="card divide-y divide-line overflow-hidden">
                {group.map((place) => {
                  const meta = categoryOf(place.category);
                  return (
                    <li key={place.id} className="flex items-center gap-3 px-3 py-2.5">
                      <span
                        aria-hidden
                        className="grid size-8 shrink-0 place-items-center rounded-full text-sm"
                        style={{ background: `${meta.color}22` }}
                      >
                        {meta.icon}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{place.name}</p>
                        <p className="truncate text-xs text-muted">
                          {meta.label}
                          {place.notes ? ` · ${place.notes}` : ""}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <StarRating value={place.rating} size="sm" />
                        <span className="text-xs text-muted">
                          {place.status === "visited" ? "✅" : "🔖"}
                        </span>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
