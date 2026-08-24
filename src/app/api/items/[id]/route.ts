import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/user";
import { firstIssue, itemUpdateSchema } from "@/lib/validation";

async function loadOwned(id: string, userId: string) {
  const item = await prisma.itineraryItem.findUnique({
    where: { id },
    include: { trip: { select: { userId: true } } },
  });
  return item && item.trip.userId === userId ? item : null;
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  const { id } = await params;

  const existing = await loadOwned(id, user.id);
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const parsed = itemUpdateSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: firstIssue(parsed.error) }, { status: 400 });
  }
  const data = parsed.data;

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
    include: { place: true },
  });
  return NextResponse.json({ item });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  const { id } = await params;

  const existing = await loadOwned(id, user.id);
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.itineraryItem.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
