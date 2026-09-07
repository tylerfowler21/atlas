import { NextResponse } from "next/server";
import { get } from "@vercel/blob";
import { prisma } from "@/lib/prisma";
import { unauthorized } from "@/lib/api";
import { getCurrentUser } from "@/lib/user";
import { removePhoto } from "@/lib/photos";

/// Streams a private photo back to its owner. This route is the only way to
/// read one: the blob itself is not public, so there is no URL to leak.
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return unauthorized();
  const { id } = await params;

  const photo = await prisma.photo.findUnique({ where: { id } });
  if (!photo || photo.userId !== user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const blob = await get(photo.pathname, { access: "private" });
  if (!blob) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return new Response(blob.stream, {
    headers: {
      "Content-Type": photo.contentType,
      "Content-Length": String(photo.size),
      // Not stored at all. `private` keeps it out of shared caches but not out
      // of this browser's, and on a shared computer that means the same URL
      // still serves the last person's photo after they have signed out.
      "Cache-Control": "private, no-store",
    },
  });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return unauthorized();
  const { id } = await params;

  const photo = await prisma.photo.findUnique({ where: { id } });
  if (!photo || photo.userId !== user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await prisma.photo.delete({ where: { id } });
  await removePhoto(photo.pathname);

  return NextResponse.json({ ok: true });
}
