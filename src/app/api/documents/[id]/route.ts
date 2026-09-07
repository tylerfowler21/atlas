import { NextResponse } from "next/server";
import { get } from "@vercel/blob";
import { prisma } from "@/lib/prisma";
import { unauthorized } from "@/lib/api";
import { getCurrentUser } from "@/lib/user";
import { tripAccess } from "@/lib/trip-access";
import { removeDocument } from "@/lib/trip-documents";
import type { CurrentUser } from "@/lib/user";

/// A trip's file is readable by anyone who can read the trip. That is the
/// point of sharing one: the person you are travelling with needs the hotel
/// confirmation as much as you do.
async function loadReadable(id: string, user: CurrentUser) {
  const document = await prisma.tripDocument.findUnique({ where: { id } });
  if (!document) return null;
  return (await tripAccess(document.tripId, user)) ? document : null;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return unauthorized();
  const { id } = await params;

  const document = await loadReadable(id, user);
  if (!document) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const blob = await get(document.pathname, { access: "private" });
  if (!blob) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return new Response(blob.stream, {
    headers: {
      "Content-Type": document.contentType,
      "Content-Length": String(document.size),
      // Inline, so a PDF opens in the browser rather than landing in Downloads
      // — you are usually checking a reference, not filing it. The filename is
      // quoted and stripped of quotes of its own, since it came from a user.
      "Content-Disposition": `inline; filename="${document.name.replace(/["\\]/g, "")}"`,
      // Not stored at all. `private` keeps it out of shared caches but not out
      // of this browser's, and on a shared computer that means the same URL
      // still serves the last person's hotel confirmation after they sign out.
      // Re-fetching a PDF nobody opens twice is the cheaper mistake.
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

  const document = await loadReadable(id, user);
  if (!document) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.tripDocument.delete({ where: { id } });
  await removeDocument(document.pathname);
  return NextResponse.json({ ok: true });
}
