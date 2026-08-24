import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { unauthorized } from "@/lib/api";
import { getCurrentUser } from "@/lib/user";
import { tripAccess } from "@/lib/trip-access";
import { firstIssue, tripUpdateSchema } from "@/lib/validation";

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

  const trip = await prisma.trip.update({ where: { id }, data: parsed.data });
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
