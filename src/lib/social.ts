import { prisma } from "@/lib/prisma";
import type { PublicItemDTO, PublicTripDTO } from "@/lib/types";
import { toPublicPlace } from "@/lib/types";

/// What a published trip exposes. Same allow-list discipline as share links:
/// the itinerary and its locations, never the owner's private notes or ratings
/// on the underlying places.
export type FeedTrip = PublicTripDTO & {
  id: string;
  publishedAt: string;
  stopCount: number;
  author: { username: string | null; name: string | null; image: string | null };
  copiedFrom: { username: string | null; title: string } | null;
};

const AUTHOR_SELECT = { username: true, name: true, image: true } as const;

export function toFeedTrip(trip: {
  id: string;
  title: string;
  destination: string | null;
  startDate: Date | null;
  endDate: Date | null;
  color: string;
  publishedAt: Date | null;
  user: { username: string | null; name: string | null; image: string | null };
  copiedFrom: { title: string; user: { username: string | null } } | null;
  _count: { items: number };
}): FeedTrip {
  return {
    id: trip.id,
    title: trip.title,
    destination: trip.destination,
    startDate: trip.startDate?.toISOString() ?? null,
    endDate: trip.endDate?.toISOString() ?? null,
    color: trip.color,
    publishedAt: (trip.publishedAt ?? new Date()).toISOString(),
    stopCount: trip._count.items,
    author: trip.user,
    copiedFrom: trip.copiedFrom
      ? { username: trip.copiedFrom.user.username, title: trip.copiedFrom.title }
      : null,
  };
}

export const feedTripInclude = {
  user: { select: AUTHOR_SELECT },
  copiedFrom: { select: { title: true, user: { select: { username: true } } } },
  _count: { select: { items: true } },
} as const;

/// A published trip, readable by anyone. Returns null for private ones so
/// callers answer 404 rather than confirming the trip exists.
export async function loadPublishedTrip(tripId: string) {
  const trip = await prisma.trip.findUnique({
    where: { id: tripId },
    include: {
      ...feedTripInclude,
      items: {
        orderBy: [{ dayIndex: "asc" }, { position: "asc" }],
        include: { place: true },
      },
    },
  });
  if (!trip || !trip.publishedAt) return null;

  const items: PublicItemDTO[] = trip.items.map((item) => ({
    id: item.id,
    title: item.title,
    emoji: item.emoji,
    notes: item.notes,
    dayIndex: item.dayIndex,
    startTime: item.startTime,
    category: item.category,
    position: item.position,
    place: item.place ? toPublicPlace(item.place) : null,
  }));

  return { trip, items };
}
