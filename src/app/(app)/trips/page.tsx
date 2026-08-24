import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/user";
import { serializeTrip } from "@/lib/types";
import { formatRange, relativeLabel } from "@/lib/trips";
import NewTripForm from "@/components/NewTripForm";

export const dynamic = "force-dynamic";

export default async function TripsPage() {
  const user = await getCurrentUser();
  const trips = await prisma.trip.findMany({
    where: { userId: user.id },
    orderBy: [{ startDate: "desc" }, { createdAt: "desc" }],
    include: { _count: { select: { items: true } } },
  });

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold">Trips</h1>
          <p className="mt-1 text-sm text-muted">
            Plan a trip day by day from the places you&apos;ve saved.
          </p>
        </div>
        <NewTripForm />
      </div>

      {trips.length === 0 ? (
        <p className="mt-10 text-sm text-muted">No trips yet.</p>
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
