import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { unauthorized } from "@/lib/api";
import { getCurrentUser } from "@/lib/user";
import {
  ALLOWED_IMAGE_TYPES,
  MAX_PHOTO_BYTES,
  photoStorageConfigured,
  storePhoto,
} from "@/lib/photos";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return unauthorized();

  if (!photoStorageConfigured()) {
    return NextResponse.json(
      { error: "Photo storage isn't set up on this server yet" },
      { status: 503 },
    );
  }

  const form = await request.formData();
  const file = form.get("file");
  const memoryId = String(form.get("memoryId") ?? "");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file received" }, { status: 400 });
  }
  if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
    return NextResponse.json(
      { error: "That file type isn't supported — use a photo" },
      { status: 400 },
    );
  }
  if (file.size > MAX_PHOTO_BYTES) {
    return NextResponse.json(
      { error: `Photos need to be under ${Math.round(MAX_PHOTO_BYTES / 1024 / 1024)}MB` },
      { status: 400 },
    );
  }

  // Only onto your own entry.
  const memory = await prisma.memory.findUnique({ where: { id: memoryId } });
  if (!memory || memory.userId !== user.id) {
    return NextResponse.json({ error: "Unknown entry" }, { status: 400 });
  }

  const stored = await storePhoto({ userId: user.id, memoryId, file });

  const photo = await prisma.photo.create({
    data: {
      userId: user.id,
      memoryId,
      pathname: stored.pathname,
      contentType: file.type,
      size: stored.size,
    },
    select: { id: true, contentType: true, size: true, createdAt: true },
  });

  return NextResponse.json({ photo }, { status: 201 });
}
