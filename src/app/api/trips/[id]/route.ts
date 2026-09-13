import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { unauthorized } from "@/lib/api";
import { getCurrentUser } from "@/lib/user";
import { tripAccess } from "@/lib/trip-access";
import { placesForDestinations } from "@/lib/trip-destinations";
import { firstIssue, tripUpdateSchema } from "@/lib/validation";
import { placeForViewer, serializeTrip } from "@/lib/types";

/// One trip with its itinerary.
///
/// The website renders this page on the server, so nothing served it as data
/// until the app needed it. It reuses tripAccess and the same serializers the
/// page uses, so a collaborator sees exactly what they see in a browser — and
/// somebody with no access gets the same 404, rather than a 403 that would
/// confirm the trip exists.
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return unauthorized();

  const { id } = await params;
  const access = await tripAccess(id, user);
  if (!access) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const trip = await prisma.trip.findUnique({
    where: { id },
    include: {
      items: {
        orderBy: [{ dayIndex: "asc" }, { position: "asc" }],
        include: { place: true, toPlace: true },
      },
      resources: { orderBy: { position: "asc" } },
      documents: { orderBy: { createdAt: "desc" } },
    },
  });
  if (!trip) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({
    trip: serializeTrip(trip),
    role: access.role,
    resources: trip.resources,
    documents: trip.documents.map((d) => ({
      id: d.id,
      tripId: d.tripId,
      name: d.name,
      contentType: d.contentType,
      size: d.size,
      itemId: d.itemId,
      createdAt: d.createdAt.toISOString(),
    })),
    items: trip.items.map((item) => ({
      ...item,
      // A date crosses the wire as a string, like every other one here.
      bookBy: item.bookBy?.toISOString() ?? null,
      place: item.place ? placeForViewer(item.place, user.id) : null,
      toPlace: item.toPlace ? placeForViewer(item.toPlace, user.id) : null,
    })),
  });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return unauthorized();
  const { id } = await params;

  // Editors change the itinerary, not the trip itself.
  const access = await tripAccess(id, user);
  if (!access) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (access.role !== "owner") {
    return NextResponse.json(
      { error: "Only the trip owner can change these details" },
      { status: 403 },
    );
  }
  const existing = access.trip;

  const parsed = tripUpdateSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: firstIssue(parsed.error) }, { status: 400 });
  }

  const start = parsed.data.startDate ?? existing.startDate;
  const end = parsed.data.endDate ?? existing.endDate;
  if (start && end && end < start) {
    return NextResponse.json({ error: "The trip ends before it starts" }, { status: 400 });
  }

  const { published, ...fields } = parsed.data;
  const trip = await prisma.trip.update({
    where: { id },
    data: {
      ...fields,
      // Republishing an already-published trip keeps its original timestamp,
      // so a small edit does not shove it back to the top of every feed.
      ...(published === undefined
        ? {}
        : { publishedAt: published ? (existing.publishedAt ?? new Date()) : null }),
    },
  });

  // Destinations added after the fact land on the map too, so it makes no
  // difference whether somebody named the city when they made the trip or a
  // week later. Only the new ones: the helper skips what is already there.
  if (parsed.data.destinations) {
    const added = parsed.data.destinations.filter((d) => !existing.destinations.includes(d));
    await placesForDestinations({
      userId: user.id,
      destinations: added,
      endsOn: end ?? start ?? null,
    });
  }

  return NextResponse.json({ trip });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return unauthorized();
  const { id } = await params;

  const access = await tripAccess(id, user);
  if (!access) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (access.role !== "owner") {
    return NextResponse.json(
      { error: "Only the trip owner can delete this trip" },
      { status: 403 },
    );
  }

  await prisma.trip.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
