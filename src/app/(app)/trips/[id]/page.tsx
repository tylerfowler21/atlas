import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/user";
import { tripAccess } from "@/lib/trip-access";
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

  const access = await tripAccess(id, user);
  if (!access) notFound();

  const trip = await prisma.trip.findUniqueOrThrow({
    where: { id },
    include: {
      items: {
        orderBy: [{ dayIndex: "asc" }, { position: "asc" }],
        include: { place: true, toPlace: true },
      },
      resources: { orderBy: { position: "asc" } },
    },
  });

  // Editors see whose trip they are helping with.
  const ownerRecord = await prisma.user.findUnique({
    where: { id: trip.userId },
    select: { name: true, email: true, image: true },
  });
  const owner =
    access.role === "owner" ? "You" : (ownerRecord?.name ?? ownerRecord?.email ?? "Someone");

  // Loaded here rather than fetched on open, so the trip shows who is on it the
  // moment it renders instead of after a click.
  const collaborators = await prisma.tripCollaborator.findMany({
    where: { tripId: id },
    orderBy: { invitedAt: "asc" },
    include: { user: { select: { name: true, image: true } } },
  });

  const places = await prisma.place.findMany({
    where: { userId: user.id },
    orderBy: { name: "asc" },
  });

  const items: ItineraryItemDTO[] = trip.items.map((item) => ({
    ...item,
    place: item.place ? serializePlace(item.place) : null,
    toPlace: item.toPlace ? serializePlace(item.toPlace) : null,
  }));

  return (
    <TripPlanner
      trip={serializeTrip(trip)}
      initialItems={items}
      places={places.map(serializePlace)}
      resources={trip.resources}
      role={access.role}
      ownerLabel={owner}
      ownerImage={ownerRecord?.image ?? null}
      people={collaborators.map((c) => ({
        email: c.email,
        role: c.role,
        accepted: c.acceptedAt !== null,
        name: c.user?.name ?? null,
        image: c.user?.image ?? null,
      }))}
    />
  );
}
