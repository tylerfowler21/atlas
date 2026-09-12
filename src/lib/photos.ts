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

/// One uploaded image, stored under a pathname you choose.
///
/// The access is the caller's decision because it is not the same everywhere.
/// A journal photo and a private trip's cover are private, and read back
/// through a route that checks who is asking. A photograph of a place is
/// public, because places show on published trips and shared links where the
/// person looking is not signed in to anything — private storage there would
/// simply break them.
export class BlobAccessError extends Error {}

/// Which store to write to.
///
/// A Blob store is public or private for life — the mode is fixed when it is
/// created and cannot be changed afterwards — so the two kinds of file this
/// app stores need two stores. Journal photos and trip covers stay in the
/// private one, which is the default. A place's photograph has to be readable
/// by strangers holding a share link, so it goes to a public store connected
/// alongside it under the PLACE_PHOTOS_ prefix.
///
/// Undefined when that store is not configured, which leaves the SDK on the
/// default and produces the explicit error below rather than a surprise.
function publicStore() {
  const token = process.env.PLACE_PHOTOS_READ_WRITE_TOKEN;
  const storeId = process.env.PLACE_PHOTOS_STORE_ID;
  if (!token && !storeId) return {};
  return { ...(token ? { token } : {}), ...(storeId ? { storeId } : {}) };
}

export async function storeImage(input: {
  pathname: string;
  file: File;
  access: "public" | "private";
}) {
  try {
    const blob = await put(input.pathname, input.file, {
      access: input.access,
      addRandomSuffix: true,
      contentType: input.file.type,
      ...(input.access === "public" ? publicStore() : {}),
    });
    return { pathname: blob.pathname, url: blob.url };
  } catch (error) {
    // A store is configured for one or the other, and a public object cannot
    // be written to a private store. Worth saying plainly: it is a setting on
    // the store rather than anything wrong with the photo, and a 500 sends
    // whoever hits it looking in the wrong place entirely.
    if (
      error instanceof Error &&
      /private store|public access|access on a/i.test(error.message)
    ) {
      throw new BlobAccessError(
        "No public Blob store is configured. A place's photo has to be readable on shared trips, and a store's access mode cannot be changed after it is created — so this needs a second, public store connected with the PLACE_PHOTOS_ prefix.",
      );
    }
    throw error;
  }
}

export function extensionForImage(contentType: string) {
  return extensionFor(contentType);
}

export async function removePhoto(pathname: string) {
  try {
    await del(pathname);
  } catch (error) {
    // A blob that has already gone should not stop the row being deleted.
    // Anything else — no token, the store refusing — is rethrown so the row
    // stays and the delete can be tried again, rather than leaving a file
    // paid for and unreachable.
    if (error instanceof Error && /not.?found|404/i.test(error.message)) {
      console.warn("[photos] blob already gone", pathname);
      return;
    }
    throw error;
  }
}
