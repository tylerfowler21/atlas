import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { unauthorized } from "@/lib/api";
import { getCurrentUser } from "@/lib/user";
import { tripAccess } from "@/lib/trip-access";
import {
  ALLOWED_DOCUMENT_TYPES,
  MAX_DOCUMENT_BYTES,
  documentStorageConfigured,
  storeDocument,
} from "@/lib/trip-documents";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return unauthorized();
  const { id: tripId } = await params;

  // Editors too: whoever booked the hotel is not always whoever made the trip.
  const access = await tripAccess(tripId, user);
  if (!access) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (!documentStorageConfigured()) {
    return NextResponse.json(
      { error: "File storage isn't set up on this deployment" },
      { status: 503 },
    );
  }

  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: "No file was sent" }, { status: 400 });
  }

  if (!ALLOWED_DOCUMENT_TYPES.has(file.type)) {
    return NextResponse.json(
      { error: "That file type isn't supported — PDFs, Word, Excel, text and images are" },
      { status: 400 },
    );
  }

  if (file.size > MAX_DOCUMENT_BYTES) {
    return NextResponse.json(
      { error: `Files are limited to ${Math.round(MAX_DOCUMENT_BYTES / (1024 * 1024))} MB` },
      { status: 400 },
    );
  }

  const stored = await storeDocument({ tripId, file });

  const document = await prisma.tripDocument.create({
    data: {
      tripId,
      userId: user.id,
      pathname: stored.pathname,
      // Trimmed rather than trusted: this is somebody's filename, and it is
      // rendered as text.
      name: (file.name || "Untitled").slice(0, 200),
      contentType: file.type,
      size: stored.size,
    },
  });

  return NextResponse.json({ document }, { status: 201 });
}
