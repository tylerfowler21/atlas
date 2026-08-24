import Explorer from "@/components/Explorer";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/user";
import { serializePlace, serializeTrip } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function MapPage() {
  const user = await getCurrentUser();

  const [places, trips] = await Promise.all([
    prisma.place.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
    }),
    prisma.trip.findMany({
      where: { userId: user.id },
      orderBy: [{ startDate: "desc" }, { createdAt: "desc" }],
    }),
  ]);

  return (
    <Explorer
      initialPlaces={places.map(serializePlace)}
      trips={trips.map(serializeTrip)}
    />
  );
}
