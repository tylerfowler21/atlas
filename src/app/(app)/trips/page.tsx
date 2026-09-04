import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/user";
import { visibleTripsWhere } from "@/lib/trip-access";
import { serializeTrip } from "@/lib/types";
import { formatRange, relativeLabel } from "@/lib/trips";
import NewTripForm from "@/components/NewTripForm";

export const dynamic = "force-dynamic";

export default async function TripsPage() {
  const user = await requireUser();
  const trips = await prisma.trip.findMany({
    where: visibleTripsWhere(user),
    orderBy: [{ startDate: "desc" }, { createdAt: "desc" }],
    include: { _count: { select: { items: true } }, user: { select: { name: true, email: true } } },
  });

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      {/* The heading sits above the actions rather than beside them.
          New trip opens into a card in this row, and while it shared a line
          with the heading it squeezed it into a column two words wide. */}
      <div>
        <h1 className="text-xl font-semibold">Trips</h1>
        <p className="mt-1 text-sm text-muted">
          Plan a trip day by day from the places you&apos;ve saved.
        </p>
      </div>

      <div className="mt-4 flex flex-wrap items-start gap-2">
        {/* Drafting had no way in but the address bar: the only route to it
            was a button marked "Import a file", which is not what somebody
            wanting a trip planned goes looking for. */}
        <Link href="/import?mode=draft" className="btn btn-ghost whitespace-nowrap">
          ✨ Plan one for me
        </Link>
        <Link href="/import" className="btn btn-ghost whitespace-nowrap">
          Import a file
        </Link>
        <Link href="/trips/import" className="btn btn-ghost whitespace-nowrap">
          Add a past trip
        </Link>
        <NewTripForm />
      </div>

      {trips.length === 0 ? (
        <div className="card mt-10 space-y-3 p-5 text-center">
          <p className="text-sm font-medium">No trips yet</p>
          <p className="mx-auto max-w-md text-sm text-muted">
            Planning something? Start a new trip and build it from your saved
            places. Already been somewhere? Paste the itinerary and every stop
            is found and pinned for you.
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            <Link href="/import?mode=draft" className="btn btn-primary">
              ✨ Plan one for me
            </Link>
            <Link href="/trips/import" className="btn btn-ghost">
              Add a past trip
            </Link>
          </div>
        </div>
      ) : (
        <ul className="mt-8 space-y-3">
          {trips.map((trip) => {
            const dto = serializeTrip(trip);
            const when = relativeLabel(dto);
            return (
              <li key={trip.id}>
                <Link
                  href={`/trips/${trip.id}`}
                  className="card flex items-center gap-3 px-4 py-3 transition-colors hover:bg-foreground/5"
                >
                  <span
                    aria-hidden
                    className="h-10 w-1.5 shrink-0 rounded-full"
                    style={{ background: trip.color }}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{trip.title}</p>
                    <p className="truncate text-xs text-muted">
                      {[trip.destination, formatRange(dto)].filter(Boolean).join(" · ")}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    {trip.userId !== user.id && (
                      <p className="text-xs text-accent-text">
                        shared by {trip.user.name ?? trip.user.email}
                      </p>
                    )}
                    {when && <p className="text-xs font-medium">{when}</p>}
                    <p className="text-xs text-muted">
                      {trip._count.items} {trip._count.items === 1 ? "stop" : "stops"}
                    </p>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
