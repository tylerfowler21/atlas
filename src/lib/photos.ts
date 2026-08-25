import { put, del } from "@vercel/blob";

/// Photos are stored with private access, so the blob URL is not a way in:
/// reading one goes through /api/photos/[id], which checks who is asking.
/// Deleting an entry therefore revokes access rather than merely hiding it.

export const MAX_PHOTO_BYTES = 12 * 1024 * 1024;

export const ALLOWED_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
  "image/avif",
  "image/gif",
]);

export function photoStorageConfigured() {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN);
}

function extensionFor(contentType: string) {
  const known: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/heic": "heic",
    "image/heif": "heif",
    "image/avif": "avif",
    "image/gif": "gif",
  };
  return known[contentType] ?? "bin";
}

/// Namespaced by user so one person's pathnames can never collide with
/// another's, and a random suffix so an uploaded filename is never guessable.
export async function storePhoto(input: {
  userId: string;
  memoryId: string;
  file: File;
}) {
  const extension = extensionFor(input.file.type);
  const pathname = `memories/${input.userId}/${input.memoryId}/photo.${extension}`;

  const blob = await put(pathname, input.file, {
    access: "private",
    addRandomSuffix: true,
    contentType: input.file.type,
  });

  return { pathname: blob.pathname, size: input.file.size };
}

export async function removePhoto(pathname: string) {
  try {
    await del(pathname);
  } catch (error) {
    // A blob that has already gone should not stop the row being deleted.
    console.warn("[photos] could not delete blob", pathname, error);
  }
}
