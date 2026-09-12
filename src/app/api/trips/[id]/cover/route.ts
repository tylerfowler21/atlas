import { NextResponse } from "next/server";
import { get } from "@vercel/blob";
import { prisma } from "@/lib/prisma";
import { unauthorized } from "@/lib/api";
import { getCurrentUser } from "@/lib/user";
import { tripAccess } from "@/lib/trip-access";
import {
  ALLOWED_IMAGE_TYPES,
  MAX_PHOTO_BYTES,
  coverStorageConfigured,
  removeTripCover,
  storeTripCover,
} from "@/lib/trip-cover";

/// The photograph at the head of a trip.
///
/// Gated by tripAccess rather than by ownership, so a collaborator sees the
/// cover on the trip they were invited to — and somebody with no access gets
/// the same 404 the trip itself gives, rather than a 403 confirming it exists.

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return unauthorized();

  const { id } = await params;
  const access = await tripAccess(id, user);
  if (!access?.trip.coverPathname) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const blob = await get(access.trip.coverPathname, { access: "private" });
  if (!blob) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return new Response(blob.stream, {
    headers: {
      "Content-Type": access.trip.coverType ?? "image/jpeg",
      // Not stored at all, for the reason the journal photos are not: `private`
      // keeps it out of shared caches but not out of this browser's, and on a
      // shared computer the same URL would still serve the last person's trip.
      "Cache-Control": "private, no-store",
    },
  });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return unauthorized();

  const { id } = await params;
  const access = await tripAccess(id, user);
  if (!access) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (!coverStorageConfigured()) {
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

  const previous = access.trip.coverPathname;
  const { pathname } = await storeTripCover({ userId: user.id, tripId: id, file });

  await prisma.trip.update({
    where: { id },
    data: { coverPathname: pathname, coverType: file.type },
  });

  // The old one only after the new one is safely recorded: losing the picture
  // somebody just replaced is worse than paying for a blob nobody reads.
  if (previous) await removeTripCover(previous).catch(() => {});

  return NextResponse.json({ ok: true });
}

/// Puts the trip back to borrowing a photograph of one of its own stops.
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return unauthorized();

  const { id } = await params;
  const access = await tripAccess(id, user);
  if (!access) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const previous = access.trip.coverPathname;
  await prisma.trip.update({
    where: { id },
    data: { coverPathname: null, coverType: null },
  });
  if (previous) await removeTripCover(previous).catch(() => {});

  return NextResponse.json({ ok: true });
}
