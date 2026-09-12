import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { unauthorized } from "@/lib/api";
import { getCurrentUser } from "@/lib/user";
import {
  ALLOWED_IMAGE_TYPES,
  BlobAccessError,
  MAX_PHOTO_BYTES,
  extensionForImage,
  photoStorageConfigured,
  removePhoto,
  storeImage,
} from "@/lib/photos";

/// A photograph of a place, taken by whoever saved it.
///
/// Wikipedia is an encyclopedia, so it has Fushimi Inari and nothing at all
/// for the bar round the corner — which is most of what anybody saves. This
/// is the other half: your own photograph, which is never the wrong building.
///
/// Stored publicly, unlike a journal photo or a private trip's cover. A
/// place's photograph already shows on published trips and shared links,
/// where the person looking is signed in to nothing; putting it behind an
/// access check would break the pages it appears on.

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return unauthorized();

  const { id } = await params;
  const place = await prisma.place.findFirst({ where: { id, userId: user.id } });
  if (!place) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (!photoStorageConfigured()) {
    return NextResponse.json(
      { error: "Photo storage is not configured on this server" },
      { status: 501 },
    );
  }

  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Choose a photo to upload" }, { status: 400 });
  }
  if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
    return NextResponse.json({ error: "That file is not a photo" }, { status: 400 });
  }
  if (file.size > MAX_PHOTO_BYTES) {
    return NextResponse.json({ error: "That photo is too large" }, { status: 400 });
  }

  const previous = place.photoPathname;
  let stored;
  try {
    stored = await storeImage({
      pathname: `places/${user.id}/${id}/photo.${extensionForImage(file.type)}`,
      file,
      access: "public",
    });
  } catch (error) {
    if (error instanceof BlobAccessError) {
      return NextResponse.json({ error: error.message }, { status: 501 });
    }
    throw error;
  }

  const updated = await prisma.place.update({
    where: { id },
    data: {
      photoUrl: stored.url,
      photoPathname: stored.pathname,
      // Wikipedia's credit belonged to Wikipedia's picture. This one is the
      // owner's, and needs none.
      photoAttribution: null,
      photoSourceUrl: null,
      // Stamped so the lazy backfill leaves it alone — it only ever looks at
      // places nobody has checked, and a photograph somebody chose is not
      // something to go looking for a replacement for.
      photoCheckedAt: new Date(),
    },
  });

  // Only after the new one is recorded: losing the picture somebody just
  // replaced is worse than paying for a blob nobody reads.
  if (previous) await removePhoto(previous).catch(() => {});

  return NextResponse.json({ photoUrl: updated.photoUrl });
}

/// Puts the place back to having whatever Wikipedia can find for it, which for
/// most places is nothing.
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return unauthorized();

  const { id } = await params;
  const place = await prisma.place.findFirst({ where: { id, userId: user.id } });
  if (!place) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const previous = place.photoPathname;
  await prisma.place.update({
    where: { id },
    data: {
      photoUrl: null,
      photoPathname: null,
      photoAttribution: null,
      photoSourceUrl: null,
      // Cleared so the backfill has another look. Somebody who removes their
      // own photograph is asking for the place to go back to how it was, not
      // for it to stay blank for good.
      photoCheckedAt: null,
    },
  });
  if (previous) await removePhoto(previous).catch(() => {});

  return NextResponse.json({ ok: true });
}
