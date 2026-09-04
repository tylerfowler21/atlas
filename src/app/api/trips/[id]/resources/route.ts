import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { unauthorized } from "@/lib/api";
import { getCurrentUser } from "@/lib/user";
import { tripAccess } from "@/lib/trip-access";
import { firstIssue, resourceCreateSchema } from "@/lib/validation";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return unauthorized();
  const { id: tripId } = await params;

  // Editors can add these. Half the point of a shared trip is that whoever
  // knows about the rail pass is not always whoever made the trip.
  const access = await tripAccess(tripId, user);
  if (!access) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const parsed = resourceCreateSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: firstIssue(parsed.error) }, { status: 400 });
  }

  const last = await prisma.tripResource.findFirst({
    where: { tripId },
    orderBy: { position: "desc" },
    select: { position: true },
  });

  const resource = await prisma.tripResource.create({
    data: { ...parsed.data, tripId, position: (last?.position ?? -1) + 1 },
  });
  return NextResponse.json({ resource });
}
