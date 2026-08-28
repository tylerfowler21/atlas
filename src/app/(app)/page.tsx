import Explorer from "@/components/Explorer";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/user";
import { serializePlace, serializeTrip } from "@/lib/types";
import { firstSteps } from "@/lib/first-steps";

export const dynamic = "force-dynamic";

export default async function MapPage({
  searchParams,
}: {
  searchParams: Promise<{ place?: string }>;
}) {
  // ?place=<id> opens the map with that place selected — this is how the
  // Places and Trips pages hand a row over to the map.
  const { place } = await searchParams;
  const user = await requireUser();

  const [places, trips, steps] = await Promise.all([
    prisma.place.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
    }),
    prisma.trip.findMany({
      where: { userId: user.id },
      orderBy: [{ startDate: "desc" }, { createdAt: "desc" }],
    }),
    firstSteps(user.id),
  ]);

  return (
    <Explorer
      initialPlaces={places.map(serializePlace)}
      trips={trips.map(serializeTrip)}
      initialSelectedId={place ?? null}
      firstSteps={steps.hidden ? null : steps}
    />
  );
}
