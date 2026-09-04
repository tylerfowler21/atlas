import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/user";
import { prisma } from "@/lib/prisma";
import { unauthorized } from "@/lib/api";
import { newShareToken } from "@/lib/share";
import { DEFAULT_SHARE_STATUSES } from "@/lib/place-shares";
import { STATUS_IDS } from "@/lib/taxonomy";

const bodySchema = z.object({
  area: z.string().trim().min(1).max(120),
  /// Empty means every category, now and later.
  categories: z.array(z.string().min(1).max(40)).max(50).default([]),
  statuses: z.array(z.enum(STATUS_IDS)).max(3).default([]),
  note: z.string().trim().max(280).nullable().optional(),
});

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return unauthorized();

  const shares = await prisma.placeShare.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json({
    shares: shares.map((s) => ({ ...s, path: `/c/${s.token}` })),
  });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return unauthorized();

  const parsed = bodySchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Check the details" }, { status: 400 });
  }

  const share = await prisma.placeShare.create({
    data: {
      userId: user.id,
      area: parsed.data.area,
      categories: parsed.data.categories,
      statuses:
        parsed.data.statuses.length > 0 ? parsed.data.statuses : DEFAULT_SHARE_STATUSES,
      note: parsed.data.note ?? null,
      token: newShareToken(),
    },
  });

  return NextResponse.json({
    share: { ...share, path: `/c/${share.token}` },
  });
}
