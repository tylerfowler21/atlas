import type { Metadata } from "next";
import { resolvedCategories } from "@/lib/categories";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import SharedTrip from "@/components/SharedTrip";
import SignUpInvite from "@/components/SignUpInvite";
import { getCurrentUser } from "@/lib/user";
import {
  toPublicPlace,
  type PublicItemDTO,
  type PublicTripDTO,
} from "@/lib/types";

export const dynamic = "force-dynamic";

async function loadShared(token: string) {
  return prisma.tripShare.findUnique({
    where: { token },
    include: {
      trip: {
        include: {
          // Named on the sign-up invitation at the foot of the page.
          user: { select: { name: true, username: true } },
          items: {
            orderBy: [{ dayIndex: "asc" }, { position: "asc" }],
            include: { place: true, toPlace: true },
          },
        },
      },
    },
  });
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ token: string }>;
}): Promise<Metadata> {
  const { token } = await params;
  const share = await loadShared(token);

  return {
    title: share ? `${share.trip.title} — shared itinerary` : "Itinerary not found",
    // The link is the credential; it has no business in a search index.
    robots: { index: false, follow: false },
  };
}

export default async function SharedTripPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const share = await loadShared(token);

  // A revoked link is deleted outright, so "not found" covers both a bad token
  // and one the owner has since turned off.
  if (!share) notFound();

  await prisma.tripShare.update({
    where: { id: share.id },
    data: { viewCount: { increment: 1 }, lastViewedAt: new Date() },
  });

  const trip: PublicTripDTO = {
    title: share.trip.title,
    destination: share.trip.destination,
    startDate: share.trip.startDate?.toISOString() ?? null,
    endDate: share.trip.endDate?.toISOString() ?? null,
    color: share.trip.color,
  };

  const items: PublicItemDTO[] = share.trip.items.map((item) => ({
    id: item.id,
    kind: item.kind,
    mode: item.mode,
    title: item.title,
    emoji: item.emoji,
    notes: item.notes,
    dayIndex: item.dayIndex,
    startTime: item.startTime,
    endTime: item.endTime,
    category: item.category,
    position: item.position,
    place: item.place ? toPublicPlace(item.place) : null,
    toPlace: item.toPlace ? toPublicPlace(item.toPlace) : null,
  }));

  const viewer = await getCurrentUser();

  return (
    <div className="flex h-full flex-col">
      <div className="min-h-0 flex-1">
        <SharedTrip
          trip={trip}
          items={items}
          categories={await resolvedCategories(share.trip.userId)}
        />
      </div>

      {/* A secret link is the one most likely to reach somebody with no
          account: it is what you send a friend. */}
      {!viewer && (
        <SignUpInvite
          author={share.trip.user?.username ? `@${share.trip.user.username}` : (share.trip.user?.name ?? null)}
          returnTo={`/s/${token}`}
        />
      )}
    </div>
  );
}
