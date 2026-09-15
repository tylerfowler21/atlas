import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/user";
import { unauthorized } from "@/lib/api";
import { hiddenUserIds } from "@/lib/moderation";

const personSelect = {
  id: true,
  name: true,
  username: true,
  image: true,
  bio: true,
  _count: { select: { followers: true } },
  trips: { where: { publishedAt: { not: null } }, select: { id: true } },
} as const;

type PersonRow = {
  id: string;
  name: string | null;
  username: string | null;
  image: string | null;
  bio: string | null;
  _count: { followers: number };
  trips: { id: string }[];
};

function toPerson(p: PersonRow, following: boolean) {
  return {
    id: p.id,
    name: p.name,
    username: p.username,
    image: p.image,
    bio: p.bio,
    followers: p._count.followers,
    publishedTrips: p.trips.length,
    following,
  };
}

function searchWhere(query: string) {
  if (!query) return {};
  return {
    OR: [
      { username: { contains: query.toLowerCase() } },
      { name: { contains: query, mode: "insensitive" as const } },
    ],
  };
}

/// Everyone who has chosen a username, and whether you already follow them.
///
/// Only people with a username: picking one is what creates a public profile,
/// so this makes existing public profiles findable rather than listing anyone
/// who never opted in. Same rule as the web page.
///
/// `?following=1&q=` is the invite typeahead: only people you follow whose
/// name or handle contains the query, never their emails. An empty query
/// returns nobody — the whole following graph is not a suggestion list.
export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return unauthorized();

  const url = new URL(request.url);
  const query = url.searchParams.get("q")?.trim() ?? "";
  const followingOnly = url.searchParams.get("following") === "1";
  const hidden = await hiddenUserIds(user.id);

  if (followingOnly) {
    if (!query) return NextResponse.json({ people: [] });

    const follows = await prisma.follow.findMany({
      where: {
        followerId: user.id,
        ...(hidden.length ? { followingId: { notIn: hidden } } : {}),
        following: {
          username: { not: null },
          // An invite is addressed to an email; someone with none on file
          // cannot be invited this way, so they are not offered.
          email: { not: null },
          ...searchWhere(query),
        },
      },
      orderBy: { createdAt: "desc" },
      take: 8,
      select: { following: { select: personSelect } },
    });

    return NextResponse.json({
      people: follows.map((f) => toPerson(f.following, true)),
    });
  }

  const people = await prisma.user.findMany({
    where: {
      username: { not: null },
      id: { notIn: [user.id, ...hidden] },
      ...searchWhere(query),
    },
    orderBy: { createdAt: "desc" },
    take: 100,
    select: personSelect,
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
    people: people.map((p) => toPerson(p, following.has(p.id))),
  });
}
