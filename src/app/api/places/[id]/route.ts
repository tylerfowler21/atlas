import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
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
  const { id } = await params;

  const existing = await loadOwned(id, user.id);
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const parsed = placeUpdateSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: firstIssue(parsed.error) }, { status: 400 });
  }

  const data = { ...parsed.data };
  // Keep visitedAt consistent with status without clobbering an explicit date.
  if (data.status === "visited" && !existing.visitedAt && data.visitedAt === undefined) {
    data.visitedAt = new Date();
  }
  if (data.status === "wishlist") data.visitedAt = null;

  const place = await prisma.place.update({ where: { id }, data });
  return NextResponse.json({ place });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  const { id } = await params;

  const existing = await loadOwned(id, user.id);
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.place.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
