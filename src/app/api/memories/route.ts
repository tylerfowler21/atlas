import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { unauthorized } from "@/lib/api";
import { getCurrentUser } from "@/lib/user";
import { firstIssue, memoryCreateSchema } from "@/lib/validation";

const WITH_CONTEXT = {
  place: { select: { id: true, name: true, city: true, country: true } },
  trip: { select: { id: true, title: true } },
  photos: { select: { id: true }, orderBy: { createdAt: "asc" } },
} as const;

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return unauthorized();

  const { searchParams } = new URL(request.url);
  const placeId = searchParams.get("placeId");

  const memories = await prisma.memory.findMany({
    where: { userId: user.id, ...(placeId ? { placeId } : {}) },
    // Newest first by when it happened, falling back to when it was written.
    orderBy: [{ happenedOn: "desc" }, { createdAt: "desc" }],
    take: 200,
    include: WITH_CONTEXT,
  });

  return NextResponse.json({ memories });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return unauthorized();

  const parsed = memoryCreateSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: firstIssue(parsed.error) }, { status: 400 });
  }
  const data = parsed.data;

  // A memory can only be pinned to your own place or trip.
  if (data.placeId) {
    const place = await prisma.place.findUnique({ where: { id: data.placeId } });
    if (!place || place.userId !== user.id) {
      return NextResponse.json({ error: "Unknown place" }, { status: 400 });
    }
  }
  if (data.tripId) {
    const trip = await prisma.trip.findUnique({ where: { id: data.tripId } });
    if (!trip || trip.userId !== user.id) {
      return NextResponse.json({ error: "Unknown trip" }, { status: 400 });
    }
  }

  const memory = await prisma.memory.create({
    data: { ...data, userId: user.id },
    include: WITH_CONTEXT,
  });

  return NextResponse.json({ memory }, { status: 201 });
}
