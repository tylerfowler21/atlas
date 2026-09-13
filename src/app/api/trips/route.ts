import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { unauthorized } from "@/lib/api";
import { getCurrentUser } from "@/lib/user";
import { visibleTripsWhere } from "@/lib/trip-access";
import { firstIssue, tripCreateSchema } from "@/lib/validation";
import { placesForDestinations } from "@/lib/trip-destinations";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return unauthorized();
  const trips = await prisma.trip.findMany({
    // Trips you own plus trips you have been invited to edit.
    where: visibleTripsWhere(user),
    orderBy: [{ startDate: "desc" }, { createdAt: "desc" }],
    include: { _count: { select: { items: true } } },
  });
  return NextResponse.json({ trips });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return unauthorized();
  const parsed = tripCreateSchema.safeParse(await request.json());

  if (!parsed.success) {
    return NextResponse.json({ error: firstIssue(parsed.error) }, { status: 400 });
  }
  const { startDate, endDate } = parsed.data;
  if (startDate && endDate && endDate < startDate) {
    return NextResponse.json({ error: "The trip ends before it starts" }, { status: 400 });
  }

  const trip = await prisma.trip.create({ data: { ...parsed.data, userId: user.id } });

  // Where it goes, onto the map. Awaited rather than left running: the client
  // reloads its places the moment this answers, and a place that lands a
  // second later is a place somebody has already looked for and not found.
  await placesForDestinations({
    userId: user.id,
    destinations: parsed.data.destinations ?? [],
    endsOn: endDate ?? startDate ?? null,
  });

  return NextResponse.json({ trip }, { status: 201 });
}
