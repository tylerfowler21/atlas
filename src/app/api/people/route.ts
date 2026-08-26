import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/user";
import { unauthorized } from "@/lib/api";
import { hiddenUserIds } from "@/lib/moderation";

/// Everyone who has chosen a username, and whether you already follow them.
///
/// Only people with a username: picking one is what creates a public profile,
/// so this makes existing public profiles findable rather than listing anyone
/// who never opted in. Same rule as the web page.
export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return unauthorized();

  const query = new URL(request.url).searchParams.get("q")?.trim() ?? "";
  const hidden = await hiddenUserIds(user.id);

  const people = await prisma.user.findMany({
    where: {
      username: { not: null },
      id: { notIn: [user.id, ...hidden] },
      ...(query
        ? {
            OR: [
              { username: { contains: query.toLowerCase() } },
              { name: { contains: query, mode: "insensitive" as const } },
            ],
          }
        : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 100,
    select: {
      id: true,
      name: true,
      username: true,
      image: true,
      bio: true,
      _count: { select: { followers: true } },
      trips: { where: { publishedAt: { not: null } }, select: { id: true } },
    },
  });

  const following = new Set(
    (
      await prisma.follow.findMany({
        where: { followerId: user.id },
        select: { followingId: true },
      })
    ).map((f) => f.followingId),
  );

  return NextResponse.json({
    people: people.map((p) => ({
      id: p.id,
      name: p.name,
      username: p.username,
      image: p.image,
      bio: p.bio,
      followers: p._count.followers,
      publishedTrips: p.trips.length,
      following: following.has(p.id),
    })),
  });
}
