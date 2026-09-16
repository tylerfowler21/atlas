import { NextResponse } from "next/server";
import { generateClientTokenFromReadWriteToken } from "@vercel/blob/client";
import { prisma } from "@/lib/prisma";
import { unauthorized } from "@/lib/api";
import { getCurrentUser } from "@/lib/user";
import { tripAccess } from "@/lib/trip-access";
import {
  DOCUMENT_TYPE_ERROR,
  MAX_DOCUMENT_BYTES,
  documentPathname,
  documentStorageConfigured,
  documentTooLargeError,
  resolveDocumentType,
} from "@/lib/trip-documents";

/// A short-lived token that lets the browser or the phone PUT a file straight
/// to Blob. The file never passes through this Function, which is what used
/// to drop a multi-megabyte iPhone screenshot with "the network connection
/// was lost" while a smaller PDF of the same confirmation went through.

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return unauthorized();
  const { id: tripId } = await params;

  const access = await tripAccess(tripId, user);
  if (!access) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (!documentStorageConfigured()) {
    return NextResponse.json(
      { error: "File storage isn't set up on this deployment" },
      { status: 503 },
    );
  }

  let body: { name?: unknown; contentType?: unknown; size?: unknown; itemId?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "No file was sent" }, { status: 400 });
  }

  const name = typeof body.name === "string" ? body.name : "";
  const contentType = resolveDocumentType({
    type: typeof body.contentType === "string" ? body.contentType : "",
    name,
  });
  if (!contentType) {
    return NextResponse.json({ error: DOCUMENT_TYPE_ERROR }, { status: 400 });
  }

  const size = typeof body.size === "number" ? body.size : 0;
  if (!size || size < 0) {
    return NextResponse.json({ error: "No file was sent" }, { status: 400 });
  }
  if (size > MAX_DOCUMENT_BYTES) {
    return NextResponse.json({ error: documentTooLargeError() }, { status: 400 });
  }

  const itemId = typeof body.itemId === "string" && body.itemId ? body.itemId : null;
  if (itemId) {
    const item = await prisma.itineraryItem.findUnique({ where: { id: itemId } });
    if (!item || item.tripId !== tripId) {
      return NextResponse.json({ error: "No such stop on this trip" }, { status: 400 });
    }
  }

  const pathname = documentPathname(tripId, contentType);
  const token = await generateClientTokenFromReadWriteToken({
    pathname,
    allowedContentTypes: [contentType],
    maximumSizeInBytes: MAX_DOCUMENT_BYTES,
    addRandomSuffix: true,
    allowOverwrite: false,
    validUntil: Date.now() + 60 * 60 * 1000,
  });

  return NextResponse.json({ token, pathname, contentType });
}
