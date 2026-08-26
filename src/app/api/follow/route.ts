import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { unauthorized } from "@/lib/api";
import { getCurrentUser } from "@/lib/user";
import { firstIssue, followSchema } from "@/lib/validation";
import { notify } from "@/lib/notifications";
import { isBlockedBetween } from "@/lib/moderation";

async function resolveTarget(username: string) {
  return prisma.user.findUnique({ where: { username }, select: { id: true } });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return unauthorized();

  const parsed = followSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: firstIssue(parsed.error) }, { status: 400 });
  }

  const target = await resolveTarget(parsed.data.username);
  if (!target) return NextResponse.json({ error: "No such person" }, { status: 404 });
  if (target.id === user.id) {
    return NextResponse.json({ error: "You can't follow yourself" }, { status: 400 });
  }
  if (await isBlockedBetween(user.id, target.id)) {
    return NextResponse.json({ error: "No such person" }, { status: 404 });
  }

  // Idempotent: following twice is the same as following once.
  const existing = await prisma.follow.findUnique({
    where: { followerId_followingId: { followerId: user.id, followingId: target.id } },
  });

  if (!existing) {
    await prisma.follow.create({
      data: { followerId: user.id, followingId: target.id },
    });

    // Unfollowing and following again is a new row, so without this the same
    // person could be announced repeatedly. One follow notification per pair,
    // ever, is enough.
    const announced = await prisma.notification.findFirst({
      where: { userId: target.id, actorId: user.id, kind: "follow" },
      select: { id: true },
    });
    if (!announced) {
      await notify({ userId: target.id, kind: "follow", actorId: user.id });
    }
  }

  return NextResponse.json({ following: true });
}

export async function DELETE(request: Request) {
  const user = await getCurrentUser();
  if (!user) return unauthorized();

  const username = new URL(request.url).searchParams.get("username")?.trim().toLowerCase();
  if (!username) return NextResponse.json({ error: "Which person?" }, { status: 400 });

  const target = await resolveTarget(username);
  if (!target) return NextResponse.json({ error: "No such person" }, { status: 404 });

  await prisma.follow.deleteMany({
    where: { followerId: user.id, followingId: target.id },
  });

  return NextResponse.json({ following: false });
}
