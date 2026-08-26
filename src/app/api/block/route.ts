import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { unauthorized } from "@/lib/api";
import { getCurrentUser } from "@/lib/user";
import { blockSchema, firstIssue } from "@/lib/validation";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return unauthorized();

  const parsed = blockSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: firstIssue(parsed.error) }, { status: 400 });
  }

  const target = await prisma.user.findUnique({
    where: { username: parsed.data.username },
    select: { id: true },
  });
  if (!target) return NextResponse.json({ error: "No such person" }, { status: 404 });
  if (target.id === user.id) {
    return NextResponse.json({ error: "You can't block yourself" }, { status: 400 });
  }

  await prisma.$transaction([
    prisma.block.upsert({
      where: { blockerId_blockedId: { blockerId: user.id, blockedId: target.id } },
      update: {},
      create: { blockerId: user.id, blockedId: target.id },
    }),
    // Blocking someone you follow, or who follows you, should sever it — a
    // block that leaves the follow in place is not a block.
    prisma.follow.deleteMany({
      where: {
        OR: [
          { followerId: user.id, followingId: target.id },
          { followerId: target.id, followingId: user.id },
        ],
      },
    }),
  ]);

  return NextResponse.json({ blocked: true });
}

export async function DELETE(request: Request) {
  const user = await getCurrentUser();
  if (!user) return unauthorized();

  const username = new URL(request.url).searchParams.get("username")?.trim().toLowerCase();
  if (!username) return NextResponse.json({ error: "Which person?" }, { status: 400 });

  const target = await prisma.user.findUnique({
    where: { username },
    select: { id: true },
  });
  if (!target) return NextResponse.json({ error: "No such person" }, { status: 404 });

  await prisma.block.deleteMany({ where: { blockerId: user.id, blockedId: target.id } });
  return NextResponse.json({ blocked: false });
}
