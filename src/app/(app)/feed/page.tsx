import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/user";
import { feedTripInclude, toFeedTrip } from "@/lib/social";
import TripCard from "@/components/TripCard";
import FindPeople from "@/components/FindPeople";

export const metadata: Metadata = { title: "Feed — Atlas" };
export const dynamic = "force-dynamic";

export default async function FeedPage() {
  const user = await requireUser();

  const following = await prisma.follow.findMany({
    where: { followerId: user.id },
    select: { followingId: true },
  });
  const ids = following.map((f) => f.followingId);

  const trips =
    ids.length === 0
      ? []
      : await prisma.trip.findMany({
          where: { userId: { in: ids }, publishedAt: { not: null } },
          orderBy: { publishedAt: "desc" },
          take: 50,
          include: feedTripInclude,
        });

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="text-xl font-semibold">Feed</h1>
      <p className="mt-1 text-sm text-muted">
        Trips published by people you follow. Copy any of them into your own
        account and make it your plan.
      </p>

      <div className="mt-4">
        <FindPeople />
      </div>

      {ids.length === 0 ? (
        <p className="mt-8 text-sm text-muted">
          You&apos;re not following anyone yet. Search for someone above, or share
          your own handle from{" "}
          <Link href="/settings" className="text-accent underline">
            your profile
          </Link>
          .
        </p>
      ) : trips.length === 0 ? (
        <p className="mt-8 text-sm text-muted">
          Nobody you follow has published a trip yet.
        </p>
      ) : (
        <ul className="mt-6 space-y-3">
          {trips.map((trip) => (
            <li key={trip.id}>
              <TripCard trip={toFeedTrip(trip)} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
