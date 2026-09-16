import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { unauthorized } from "@/lib/api";
import { getCurrentUser } from "@/lib/user";
import { tripAccess } from "@/lib/trip-access";
import {
  DOCUMENT_TYPE_ERROR,
  MAX_DOCUMENT_BYTES,
  documentStorageConfigured,
  documentTooLargeError,
  isDocumentPathForTrip,
  resolveDocumentType,
  storeDocument,
  storedDocumentMeta,
} from "@/lib/trip-documents";
import type { CurrentUser } from "@/lib/user";

async function attachedItem(tripId: string, itemId: string | null) {
  if (!itemId) return { itemId: null as string | null };
  const item = await prisma.itineraryItem.findUnique({ where: { id: itemId } });
  if (!item || item.tripId !== tripId) return { error: "No such stop on this trip" as const };
  return { itemId };
}

async function createDocumentRow(input: {
  tripId: string;
  user: CurrentUser;
  pathname: string;
  name: string;
  contentType: string;
  size: number;
  itemId: string | null;
}) {
  const document = await prisma.tripDocument.create({
    data: {
      tripId: input.tripId,
      userId: input.user.id,
      pathname: input.pathname,
      // Trimmed rather than trusted: this is somebody's filename, and it is
      // rendered as text.
      name: (input.name || "Untitled").slice(0, 200),
      contentType: input.contentType,
      size: input.size,
      itemId: input.itemId,
    },
  });
  return NextResponse.json({ document }, { status: 201 });
}

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

  const contentTypeHeader = request.headers.get("content-type") ?? "";
  if (contentTypeHeader.includes("application/json")) {
    return registerUploaded(request, tripId, user);
  }

  const form = await request.formData().catch(() => null);
  if (!form) {
    return NextResponse.json({ error: "No file was sent" }, { status: 400 });
  }
  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: "No file was sent" }, { status: 400 });
  }

  const header = new Uint8Array(await file.slice(0, 16).arrayBuffer());
  const contentType = resolveDocumentType({ type: file.type, name: file.name, bytes: header });
  if (!contentType) {
    return NextResponse.json({ error: DOCUMENT_TYPE_ERROR }, { status: 400 });
  }

  if (file.size > MAX_DOCUMENT_BYTES) {
    return NextResponse.json({ error: documentTooLargeError() }, { status: 400 });
  }

  // A file can be attached to the stop it confirms. Checked against this trip
  // rather than trusted: an id from a form is a claim, not a fact.
  const itemField = form.get("itemId");
  const attached = await attachedItem(
    tripId,
    typeof itemField === "string" ? itemField : null,
  );
  if ("error" in attached) {
    return NextResponse.json({ error: attached.error }, { status: 400 });
  }

  const typed = file.type === contentType ? file : new File([file], file.name, { type: contentType });
  const stored = await storeDocument({ tripId, file: typed });

  return createDocumentRow({
    tripId,
    user,
    pathname: stored.pathname,
    name: file.name,
    contentType: stored.contentType,
    size: stored.size,
    itemId: attached.itemId,
  });
}

/// The file is already in Blob. This only records it against the trip, after
/// checking the pathname is one this trip was allowed to write.
async function registerUploaded(request: Request, tripId: string, user: CurrentUser) {
  let body: {
    pathname?: unknown;
    name?: unknown;
    contentType?: unknown;
    itemId?: unknown;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "No file was sent" }, { status: 400 });
  }

  const pathname = typeof body.pathname === "string" ? body.pathname : "";
  if (!isDocumentPathForTrip(pathname, tripId)) {
    return NextResponse.json({ error: "No file was sent" }, { status: 400 });
  }

  const meta = await storedDocumentMeta(pathname);
  if (!meta) {
    return NextResponse.json({ error: "That file did not arrive" }, { status: 400 });
  }
  if (meta.size > MAX_DOCUMENT_BYTES) {
    return NextResponse.json({ error: documentTooLargeError() }, { status: 400 });
  }

  const contentType = resolveDocumentType({
    type: typeof body.contentType === "string" ? body.contentType : meta.contentType,
    name: typeof body.name === "string" ? body.name : "",
  });
  if (!contentType) {
    return NextResponse.json({ error: DOCUMENT_TYPE_ERROR }, { status: 400 });
  }

  const attached = await attachedItem(
    tripId,
    typeof body.itemId === "string" && body.itemId ? body.itemId : null,
  );
  if ("error" in attached) {
    return NextResponse.json({ error: attached.error }, { status: 400 });
  }

  return createDocumentRow({
    tripId,
    user,
    pathname: meta.pathname,
    name: typeof body.name === "string" ? body.name : "Untitled",
    contentType,
    size: meta.size,
    itemId: attached.itemId,
  });
}
