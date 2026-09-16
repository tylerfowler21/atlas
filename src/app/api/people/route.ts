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
/// `?following=1` is the short list trip invites need: only people you follow,
/// never their emails. The full directory is everyone, which gets large.
export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return unauthorized();

  const url = new URL(request.url);
  const query = url.searchParams.get("q")?.trim() ?? "";
  const followingOnly = url.searchParams.get("following") === "1";
  const suggested = url.searchParams.get("suggested") === "1";
  const hidden = await hiddenUserIds(user.id);

  if (followingOnly) {
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
      select: { following: { select: personSelect } },
    });

    return NextResponse.json({
      people: follows.map((f) => toPerson(f.following, true)),
    });
  }

  /// People worth following, for somebody following nobody.
  ///
  /// The rule is published trips, most first. Not a name in the code and not
  /// an algorithm either — with two people publishing, anything cleverer would
  /// be theatre performed over a list of two. It is the honest answer to "who
  /// is worth following here", it can be said out loud on the screen, and it
  /// keeps being right as more people publish without anybody maintaining it.
  ///
  /// Nobody is suggested who has published nothing: following them leads to an
  /// empty feed, which is the thing that teaches people following is pointless.
  /// People already followed are left out for the same reason.
  if (suggested) {
    const followed = await prisma.follow.findMany({
      where: { followerId: user.id },
      select: { followingId: true },
    });

    const candidates = await prisma.user.findMany({
      where: {
        username: { not: null },
        id: { notIn: [user.id, ...hidden, ...followed.map((f) => f.followingId)] },
        trips: { some: { publishedAt: { not: null } } },
      },
      take: 20,
      select: personSelect,
    });

    return NextResponse.json({
      people: candidates
        .map((p) => toPerson(p, false))
        .sort((a, b) => b.publishedTrips - a.publishedTrips)
        .slice(0, 5),
    });
  }

  // Only ever what somebody searched for. An empty query used to answer with
  // the hundred most recent accounts, which is a list of strangers rather than
  // a way to find anybody — nobody arrives wanting to read the newest people to
  // sign up, and everybody who picked a username was in it whether they wanted
  // to be browsed or not. Findable and listed are different things, and picking
  // a username was consent to the first.
  //
  // The list above is the exception and stays: people you already follow are a
  // short list you chose yourself, so offering it unasked is not browsing.
  if (!query) return NextResponse.json({ people: [] });

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
