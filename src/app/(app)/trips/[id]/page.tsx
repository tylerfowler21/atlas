import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/user";
import { serializePlace, serializeTrip, type ItineraryItemDTO } from "@/lib/types";
import TripPlanner from "@/components/TripPlanner";

export const dynamic = "force-dynamic";

export default async function TripPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireUser();

  const trip = await prisma.trip.findUnique({
    where: { id },
    include: {
      items: {
        orderBy: [{ dayIndex: "asc" }, { position: "asc" }],
        include: { place: true },
      },
    },
  });

  if (!trip || trip.userId !== user.id) notFound();

  const places = await prisma.place.findMany({
    where: { userId: user.id },
    orderBy: { name: "asc" },
  });

  const items: ItineraryItemDTO[] = trip.items.map((item) => ({
    ...item,
    place: item.place ? serializePlace(item.place) : null,
  }));

  return (
    <TripPlanner
      trip={serializeTrip(trip)}
      initialItems={items}
      places={places.map(serializePlace)}
    />
  );
}
