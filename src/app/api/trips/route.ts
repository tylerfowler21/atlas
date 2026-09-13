import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { unauthorized } from "@/lib/api";
import { getCurrentUser } from "@/lib/user";
import { visibleTripsWhere } from "@/lib/trip-access";
import { firstIssue, tripCreateSchema } from "@/lib/validation";
import { pinsByLabel, placesForDestinations } from "@/lib/trip-destinations";
import { regionColor, regionOfCountry } from "@/lib/regions";

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
  const body = await request.json();
  // Whether a colour was actually chosen, as opposed to the schema supplying
  // its default — which is the difference between "leave this alone" and
  // "nobody said, so where is it going?".
  const choseColour =
    typeof body === "object" && body !== null && "color" in body;
  const parsed = tripCreateSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: firstIssue(parsed.error) }, { status: 400 });
  }
  const { startDate, endDate } = parsed.data;
  if (startDate && endDate && endDate < startDate) {
    return NextResponse.json({ error: "The trip ends before it starts" }, { status: 400 });
  }

  // The pins are an argument to making the trip, not a column on it.
  const { destinationPins, ...fields } = parsed.data;
  const trip = await prisma.trip.create({ data: { ...fields, userId: user.id } });

  // Where it goes, onto the map. Awaited rather than left running: the client
  // reloads its places the moment this answers, and a place that lands a
  // second later is a place somebody has already looked for and not found.
  const countries = await placesForDestinations({
    userId: user.id,
    destinations: parsed.data.destinations ?? [],
    pins: pinsByLabel(destinationPins),
    endsOn: endDate ?? startDate ?? null,
  });

  // Coloured by where it goes, so a list of trips reads as a map before it
  // reads as words. Only when nobody picked one, and only from the first
  // destination — a trip across two continents is still one trip and needs
  // one colour, and the first is the one it is named for.
  const colour = regionColor(
    countries.map(regionOfCountry).find((r) => r !== null) ?? null,
  );
  if (!choseColour && colour && colour !== trip.color) {
    return NextResponse.json(
      { trip: await prisma.trip.update({ where: { id: trip.id }, data: { color: colour } }) },
      { status: 201 },
    );
  }

  return NextResponse.json({ trip }, { status: 201 });
}
