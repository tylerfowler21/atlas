import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/user";
import { prisma } from "@/lib/prisma";
import { unauthorized } from "@/lib/api";
import { STATUS_IDS } from "@/lib/taxonomy";

const patchSchema = z.object({
  categories: z.array(z.string().min(1).max(40)).max(50).optional(),
  statuses: z.array(z.enum(STATUS_IDS)).max(3).optional(),
  note: z.string().trim().max(280).nullable().optional(),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return unauthorized();
  const { id } = await params;

  const owned = await prisma.placeShare.findFirst({
    where: { id, userId: user.id },
    select: { id: true },
  });
  if (!owned) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const parsed = patchSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Check the details" }, { status: 400 });
  }

  const share = await prisma.placeShare.update({ where: { id }, data: parsed.data });
  return NextResponse.json({ share: { ...share, path: `/c/${share.token}` } });
}

/// Revoking, which is the whole of the security model for a secret link: the
/// token stops working and anybody holding it gets nothing.
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return unauthorized();
  const { id } = await params;

  const { count } = await prisma.placeShare.deleteMany({ where: { id, userId: user.id } });
  if (count === 0) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({ ok: true });
}
