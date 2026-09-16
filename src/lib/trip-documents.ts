/// Files belonging to a trip — the hotel confirmation, the ticket, the
/// itinerary somebody emailed over.
///
/// Stored privately and read back through an authenticated route, exactly as
/// photos are. A confirmation carries a name, a reference and usually an
/// address; a public blob URL would hand all three to anyone who guessed it.
import { put, del, head } from "@vercel/blob";

/// Bigger than a photo, because a hotel's PDF confirmation is often a
/// scanned page and an airline's is sometimes several.
export const MAX_DOCUMENT_BYTES = 20 * 1024 * 1024;

export const DOCUMENT_TYPE_ERROR =
  "That file type isn't supported — PDFs, Word, Excel, text and images are";

export function documentTooLargeError() {
  return `Files are limited to ${Math.round(MAX_DOCUMENT_BYTES / (1024 * 1024))} MB`;
}

/// What a booking confirmation actually arrives as. Images are here because
/// the commonest confirmation in the world is a screenshot of one.
export const ALLOWED_DOCUMENT_TYPES = new Map<string, string>([
  ["application/pdf", "pdf"],
  ["application/msword", "doc"],
  ["application/vnd.openxmlformats-officedocument.wordprocessingml.document", "docx"],
  ["application/vnd.ms-excel", "xls"],
  ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "xlsx"],
  ["text/plain", "txt"],
  ["text/csv", "csv"],
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/heic", "heic"],
  ["image/webp", "webp"],
]);

/// Names Photos and Safari actually send, mapped onto the type we store.
const DOCUMENT_TYPE_ALIASES = new Map<string, string>([
  ["image/jpg", "image/jpeg"],
  ["image/pjpeg", "image/jpeg"],
  ["image/x-png", "image/png"],
  ["image/heif", "image/heic"],
  ["image/heif-sequence", "image/heic"],
  ["image/heic-sequence", "image/heic"],
  ["application/x-pdf", "application/pdf"],
]);

const DOCUMENT_TYPE_FROM_EXTENSION = new Map<string, string>([
  ["pdf", "application/pdf"],
  ["doc", "application/msword"],
  ["docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
  ["xls", "application/vnd.ms-excel"],
  ["xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"],
  ["txt", "text/plain"],
  ["csv", "text/csv"],
  ["jpg", "image/jpeg"],
  ["jpeg", "image/jpeg"],
  ["png", "image/png"],
  ["heic", "image/heic"],
  ["heif", "image/heic"],
  ["webp", "image/webp"],
]);

export function documentStorageConfigured() {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN);
}

/// An icon for a file whose contents we never look inside.
export function documentIcon(contentType: string): string {
  if (contentType === "application/pdf") return "📕";
  if (contentType.startsWith("image/")) return "🖼️";
  if (contentType.includes("word")) return "📘";
  if (contentType.includes("sheet") || contentType.includes("excel")) return "📗";
  return "📄";
}

/// "1.2 MB". Sizes are shown because the only question anyone asks of a file
/// list is which one is the big scanned thing.
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function ascii(bytes: Uint8Array, start: number, length: number) {
  return String.fromCharCode(...bytes.subarray(start, start + length));
}

/// What the bytes themselves say they are. Used when the picker left the type
/// blank — Safari on iPhone does this for screenshots — so we are not stuck
/// trusting a filename.
export function documentTypeFromBytes(bytes: Uint8Array): string | null {
  if (bytes.length >= 4 && ascii(bytes, 0, 4) === "%PDF") return "application/pdf";
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47
  ) {
    return "image/png";
  }
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "image/jpeg";
  }
  if (bytes.length >= 12 && ascii(bytes, 0, 4) === "RIFF" && ascii(bytes, 8, 4) === "WEBP") {
    return "image/webp";
  }
  if (bytes.length >= 12 && ascii(bytes, 4, 4) === "ftyp") {
    const brand = ascii(bytes, 8, 4).toLowerCase();
    if (["heic", "heix", "heif", "mif1", "msf1"].includes(brand)) return "image/heic";
  }
  return null;
}

export function documentTypeFromName(name: string): string | null {
  const dot = name.lastIndexOf(".");
  if (dot < 0) return null;
  return DOCUMENT_TYPE_FROM_EXTENSION.get(name.slice(dot + 1).toLowerCase()) ?? null;
}

/// A type we will actually store, or null. Bytes first, then what the picker
/// claimed, then the filename — in that order, because iOS is happy to hand
/// over a PNG screenshot with no type at all, or with application/octet-stream.
export function resolveDocumentType(input: {
  type?: string | null;
  name?: string | null;
  bytes?: Uint8Array | null;
}): string | null {
  const sniffed = input.bytes ? documentTypeFromBytes(input.bytes) : null;
  if (sniffed) return sniffed;

  const claimed = (input.type ?? "").trim().toLowerCase();
  if (claimed && claimed !== "application/octet-stream") {
    const aliased = DOCUMENT_TYPE_ALIASES.get(claimed) ?? claimed;
    if (ALLOWED_DOCUMENT_TYPES.has(aliased)) return aliased;
  }

  return input.name ? documentTypeFromName(input.name) : null;
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
