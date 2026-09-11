import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { unauthorized } from "@/lib/api";
import { getCurrentUser } from "@/lib/user";
import { findPlacePhoto } from "@/lib/place-photo";

/// Fills in Wikipedia photographs for places the map is currently showing.
///
/// Lazily rather than when a place is saved: most places never get looked at,
/// Wikipedia has nothing for most of them anyway, and doing it at save time
/// would put a stranger's server in the path of the one action that has to
/// feel instant.
///
/// Each place is looked up once, ever. `photoCheckedAt` is stamped whether or
/// not anything was found, so the bar with no article is searched for once and
/// then left alone.
export const dynamic = "force-dynamic";

/// Two Wikipedia requests per place, and somebody is waiting. A screenful of
/// list is about a dozen places; this fills the first few and the next call
/// picks up where it left off as they scroll.
const PER_CALL = 6;

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return unauthorized();

  let ids: unknown;
  try {
    ({ ids } = (await request.json()) as { ids?: unknown });
  } catch {
    return NextResponse.json({ error: "Expected JSON" }, { status: 400 });
  }
  if (!Array.isArray(ids) || ids.some((id) => typeof id !== "string")) {
    return NextResponse.json({ error: "Expected ids" }, { status: 400 });
  }

  // Scoped to this account, so an id from somewhere else finds nothing rather
  // than telling the caller it exists.
  const places = await prisma.place.findMany({
    where: { userId: user.id, id: { in: ids as string[] }, photoCheckedAt: null },
    select: { id: true, name: true, lat: true, lng: true, city: true },
    take: PER_CALL,
  });

  const filled: {
    id: string;
    photoUrl: string | null;
    photoAttribution: string | null;
    photoSourceUrl: string | null;
  }[] = [];

  for (const place of places) {
    let photo = null;
    try {
      photo = await findPlacePhoto(place);
    } catch {
      // Wikipedia being down or slow is not this request's problem to report.
      // Leaving photoCheckedAt unset means the next call tries again, which is
      // the behaviour we want for a failure as opposed to a blank.
      continue;
    }

    await prisma.place.update({
      where: { id: place.id },
      data: {
        photoUrl: photo?.url ?? null,
        photoAttribution: photo?.attribution ?? null,
        photoSourceUrl: photo?.sourceUrl ?? null,
        photoCheckedAt: new Date(),
      },
    });

    filled.push({
      id: place.id,
      photoUrl: photo?.url ?? null,
      photoAttribution: photo?.attribution ?? null,
      photoSourceUrl: photo?.sourceUrl ?? null,
    });
  }

  // `more` says whether asking again would do anything, so the caller does not
  // have to guess from a short answer.
  return NextResponse.json({ places: filled, more: places.length === PER_CALL });
}
