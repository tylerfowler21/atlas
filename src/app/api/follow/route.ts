import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { unauthorized } from "@/lib/api";
import { getCurrentUser } from "@/lib/user";
import { firstIssue, followSchema } from "@/lib/validation";

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

  // Idempotent: following twice is the same as following once.
  await prisma.follow.upsert({
    where: { followerId_followingId: { followerId: user.id, followingId: target.id } },
    update: {},
    create: { followerId: user.id, followingId: target.id },
  });

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
