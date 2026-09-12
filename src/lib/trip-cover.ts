import { put } from "@vercel/blob";
import { ALLOWED_IMAGE_TYPES, MAX_PHOTO_BYTES, removePhoto } from "@/lib/photos";

/// The photograph at the head of a trip.
///
/// Stored privately and read back through /api/trips/[id]/cover, which asks
/// the same question the trip itself does about who is allowed to see it.
/// Public storage would have been simpler, but a private trip's cover is as
/// private as the trip, and a blob URL travels further than the page it was
/// put on.
export { ALLOWED_IMAGE_TYPES, MAX_PHOTO_BYTES };

export function coverStorageConfigured() {
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

/// Namespaced by owner and trip, with a random suffix, so one upload can never
/// land on another's pathname and none of them is guessable.
export async function storeTripCover(input: {
  userId: string;
  tripId: string;
  file: File;
}) {
  const pathname = `trips/${input.userId}/${input.tripId}/cover.${extensionFor(input.file.type)}`;
  const blob = await put(pathname, input.file, {
    access: "private",
    addRandomSuffix: true,
    contentType: input.file.type,
  });
  return { pathname: blob.pathname };
}

/// The same forgiving delete the journal photos use: a blob that has already
/// gone must not stop the row being cleared.
export const removeTripCover = removePhoto;
