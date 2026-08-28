import { NextResponse } from "next/server";
import { ownsCategory } from "@/lib/categories";
import { prisma } from "@/lib/prisma";
import { unauthorized } from "@/lib/api";
import { getCurrentUser } from "@/lib/user";
import { firstIssue, placeUpdateSchema } from "@/lib/validation";

async function loadOwned(id: string, userId: string) {
  const place = await prisma.place.findUnique({ where: { id } });
  return place && place.userId === userId ? place : null;
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return unauthorized();
  const { id } = await params;

  const existing = await loadOwned(id, user.id);
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const parsed = placeUpdateSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: firstIssue(parsed.error) }, { status: 400 });
  }

  // A category id arrives as a plain string, so it is checked against the
  // built-in ones and this person's own before it is stored.
  if (parsed.data.category && !(await ownsCategory(user.id, parsed.data.category))) {
    return NextResponse.json({ error: "No such category" }, { status: 400 });
  }

  const data = { ...parsed.data };
  // Keep visitedAt consistent with status without clobbering an explicit date.
  if (data.status === "visited" && !existing.visitedAt && data.visitedAt === undefined) {
    data.visitedAt = new Date();
  }
  if (data.status === "wishlist") {
    data.visitedAt = null;
    data.livedFrom = null;
    data.livedTo = null;
  }
  // Somewhere you lived is somewhere you have been, so it keeps a visited date
  // and still counts on the been map.
  if (data.status === "lived" && !existing.visitedAt && data.visitedAt === undefined) {
    data.visitedAt = new Date();
  }

  const place = await prisma.place.update({ where: { id }, data });
  return NextResponse.json({ place });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return unauthorized();
  const { id } = await params;

  const existing = await loadOwned(id, user.id);
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // The itinerary entries go with it.
  //
  // The relation was SetNull, which left a stop with its old title and no
  // place: still listed on the day, but with no pin, no route line and no
  // directions. Deleting somewhere should remove it from the days it was on,
  // not leave a husk that looks like a stop and behaves like nothing.
  //
  // Both ends of a journey count. A leg with one end missing is not a journey.
  const [removed] = await prisma.$transaction([
    prisma.itineraryItem.deleteMany({
      where: { OR: [{ placeId: id }, { toPlaceId: id }] },
    }),
    prisma.place.delete({ where: { id } }),
  ]);

  return NextResponse.json({ ok: true, removedFromTrips: removed.count });
}
