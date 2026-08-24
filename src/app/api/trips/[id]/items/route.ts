import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { unauthorized } from "@/lib/api";
import { getCurrentUser } from "@/lib/user";
import { firstIssue, itemCreateSchema } from "@/lib/validation";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return unauthorized();
  const { id: tripId } = await params;

  const trip = await prisma.trip.findUnique({ where: { id: tripId } });
  if (!trip || trip.userId !== user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const parsed = itemCreateSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: firstIssue(parsed.error) }, { status: 400 });
  }
  const data = parsed.data;

  // A placeId from another user's library would leak rows across accounts once
  // sharing exists, so verify ownership rather than trusting the client.
  if (data.placeId) {
    const place = await prisma.place.findUnique({ where: { id: data.placeId } });
    if (!place || place.userId !== user.id) {
      return NextResponse.json({ error: "Unknown place" }, { status: 400 });
    }
  }

  const last = await prisma.itineraryItem.findFirst({
    where: { tripId, dayIndex: data.dayIndex },
    orderBy: { position: "desc" },
    select: { position: true },
  });

  const item = await prisma.itineraryItem.create({
    data: { ...data, tripId, position: (last?.position ?? -1) + 1 },
    include: { place: true },
  });

  return NextResponse.json({ item }, { status: 201 });
}
