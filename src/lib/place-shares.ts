import { prisma } from "@/lib/prisma";
import { BEEN_STATUSES } from "@/lib/taxonomy";

/// What a share of somewhere covers, and what it deliberately leaves out.
///
/// The filters are stored rather than the places, so the link stays live: a
/// restaurant added next month appears in a link sent last week. That is the
/// difference between a guide somebody keeps and a copy that goes stale.

/// The default when somebody has not chosen: what you would actually recommend.
/// Nobody asking "where should I eat in Charleston" wants the list of places
/// you have never been to either.
export const DEFAULT_SHARE_STATUSES = [...BEEN_STATUSES];

export type ShareFilters = {
  area: string;
  categories: string[];
  statuses: string[];
};

/// The places a share covers.
///
/// Area matches a place's city or its country, the same way the map's
/// drill-down does — so "Charleston" and "Portugal" both work, and neither
/// needs its own kind of share.
export function sharedPlacesWhere(userId: string, filters: ShareFilters) {
  return {
    userId,
    OR: [{ city: filters.area }, { country: filters.area }],
    // An empty list means everything, including categories invented after the
    // link was made. Listing them all instead would quietly freeze the link to
    // the categories that existed on the day.
    ...(filters.categories.length > 0 ? { category: { in: filters.categories } } : {}),
    ...(filters.statuses.length > 0 ? { status: { in: filters.statuses } } : {}),
  };
}

export async function loadShare(token: string) {
  const share = await prisma.placeShare.findUnique({
    where: { token },
    include: { user: { select: { name: true, username: true, image: true } } },
  });
  if (!share) return null;

  const places = await prisma.place.findMany({
    where: sharedPlacesWhere(share.userId, share),
    orderBy: [{ category: "asc" }, { name: "asc" }],
  });

  return { share, places };
}

/// Counted so somebody can see a link is being used, the same as a shared trip.
/// Best-effort: a failed count is not a reason to fail the page.
export async function countShareView(id: string) {
  try {
    await prisma.placeShare.update({
      where: { id },
      data: { viewCount: { increment: 1 }, lastViewedAt: new Date() },
    });
  } catch {
    // The page has already rendered; this is bookkeeping.
  }
}
