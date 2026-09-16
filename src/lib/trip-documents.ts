/// Files belonging to a trip — the hotel confirmation, the ticket, the
/// itinerary somebody emailed over.
///
/// Stored privately and read back through an authenticated route, exactly as
/// photos are. A confirmation carries a name, a reference and usually an
/// address; a public blob URL would hand all three to anyone who guessed it.
import { put, del, head } from "@vercel/blob";
import {
  ALLOWED_DOCUMENT_TYPES,
  documentTooLargeError,
  resolveDocumentType,
} from "@/lib/document-types";

/// The naming-and-sizing half lives next door and is shared with the app,
/// which has no business putting anything in a blob but every reason to agree
/// about what a file is. Re-exported so callers here import one module.
export * from "@/lib/document-types";

/// Whether there is anywhere to put a file. Server-only by nature — the token
/// is never in a client bundle — which is why it stays on this side of the
/// wall rather than in the shared half.
export function documentStorageConfigured() {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN);
}

export function documentPathname(tripId: string, contentType: string) {
  const extension = ALLOWED_DOCUMENT_TYPES.get(contentType) ?? "bin";
  return `trips/${tripId}/document.${extension}`;
}

/// The random suffix Blob adds stays in the same folder, so a stored file is
/// `trips/{tripId}/document-….png` rather than `document.png`. Anything outside
/// that prefix is somebody pointing at a blob that is not this trip's.
export function isDocumentPathForTrip(pathname: string, tripId: string) {
  const prefix = `trips/${tripId}/`;
  if (!pathname.startsWith(prefix)) return false;
  const rest = pathname.slice(prefix.length);
  return rest.startsWith("document") && !rest.includes("/") && !pathname.includes("..");
}

/// Metadata for a blob that has already been written. Used when the file went
/// straight to Blob from the phone or the browser, and we are only recording
/// the row.
export async function storedDocumentMeta(pathname: string) {
  try {
    return await head(pathname);
  } catch {
    return null;
  }
}

/// Namespaced by trip, with a random suffix so an uploaded filename is never
/// guessable from the outside.
export async function storeDocument(input: {
  tripId: string;
  file: File;
}) {
  const contentType = resolveDocumentType({ type: input.file.type, name: input.file.name }) ?? input.file.type;
  const pathname = documentPathname(input.tripId, contentType);

  const blob = await put(pathname, input.file, {
    access: "private",
    addRandomSuffix: true,
    contentType,
  });

  return { pathname: blob.pathname, size: input.file.size, contentType };
}

export async function removeDocument(pathname: string) {
  try {
    await del(pathname);
  } catch (error) {
    // A blob that has already gone should not stop the row being deleted.
    // Anything else — no token, the store refusing — is rethrown so the row
    // stays and the delete can be tried again, rather than leaving a file
    // paid for and unreachable.
    if (error instanceof Error && /not.?found|404/i.test(error.message)) {
      console.warn("[trip-documents] blob already gone", pathname);
      return;
    }
    throw error;
  }
}

export async function errorFromUploadResponse(res: Response, fallback = "Could not upload that") {
  try {
    const json = (await res.json()) as { error?: unknown };
    if (typeof json?.error === "string") return json.error;
  } catch {
    // A 413 from the platform is HTML, not JSON, which is how a large iPhone
    // screenshot used to surface as a generic failure.
  }
  if (res.status === 413) return documentTooLargeError();
  if (res.status === 401) return "Sign in to do that";
  return fallback;
}
