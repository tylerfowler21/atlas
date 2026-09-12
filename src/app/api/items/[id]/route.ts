import { NextResponse } from "next/server";
import { ownsCategory } from "@/lib/categories";
import { prisma } from "@/lib/prisma";
import { unauthorized } from "@/lib/api";
import { getCurrentUser } from "@/lib/user";
import { tripAccess } from "@/lib/trip-access";
import { firstIssue, itemUpdateSchema } from "@/lib/validation";
import type { CurrentUser } from "@/lib/user";
import { placeForViewer } from "@/lib/types";

/// An item is editable by anyone who can edit its trip. The trip comes back
/// too, because some checks are about its owner rather than the caller.
async function loadEditable(id: string, user: CurrentUser) {
  const item = await prisma.itineraryItem.findUnique({ where: { id } });
  if (!item) return null;
  const access = await tripAccess(item.tripId, user);
  return access ? { item, access } : null;
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return unauthorized();
  const { id } = await params;

  const editable = await loadEditable(id, user);
  if (!editable) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const { item: existing, access } = editable;

  const parsed = itemUpdateSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: firstIssue(parsed.error) }, { status: 400 });
  }

  // A category id arrives as a plain string, so it is checked against the
  // built-in ones and the trip owner's own before it is stored. The owner's,
  // not the caller's: a stop filed under an editor's private category would
  // render as nothing on the owner's screen.
  if (parsed.data.category && !(await ownsCategory(access.trip.userId, parsed.data.category))) {
    return NextResponse.json({ error: "No such category" }, { status: 400 });
  }
  const data = parsed.data;

  // Everyone adds from their own library, so a place being attached must
  // belong to whoever is asking — the same check the create route makes.
  // Without it, any place id (and they are in every shared trip's payload)
  // could be attached here and read back whole, notes and all.
  for (const placeId of [data.placeId, data.toPlaceId]) {
    if (!placeId) continue;
    const place = await prisma.place.findUnique({ where: { id: placeId }, select: { userId: true } });
    if (!place || place.userId !== user.id) {
      return NextResponse.json({ error: "Unknown place" }, { status: 400 });
    }
  }

  // Moving an item to another day drops it at the end of that day unless the
  // caller said exactly where it should land.
  if (data.dayIndex !== undefined && data.dayIndex !== existing.dayIndex && data.position === undefined) {
    const last = await prisma.itineraryItem.findFirst({
      where: { tripId: existing.tripId, dayIndex: data.dayIndex },
      orderBy: { position: "desc" },
      select: { position: true },
    });
    data.position = (last?.position ?? -1) + 1;
  }

  const item = await prisma.itineraryItem.update({
    where: { id },
    data,
    include: { place: true, toPlace: true },
  });
  return NextResponse.json({
    item: {
      ...item,
      place: item.place ? placeForViewer(item.place, user.id) : null,
      toPlace: item.toPlace ? placeForViewer(item.toPlace, user.id) : null,
    },
  });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return unauthorized();
  const { id } = await params;

  if (!(await loadEditable(id, user))) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await prisma.itineraryItem.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
