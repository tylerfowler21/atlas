/// Files belonging to a trip — the hotel confirmation, the ticket, the
/// itinerary somebody emailed over.
///
/// Stored privately and read back through an authenticated route, exactly as
/// photos are. A confirmation carries a name, a reference and usually an
/// address; a public blob URL would hand all three to anyone who guessed it.
import { put, del } from "@vercel/blob";

/// Bigger than a photo, because a hotel's PDF confirmation is often a
/// scanned page and an airline's is sometimes several.
export const MAX_DOCUMENT_BYTES = 20 * 1024 * 1024;

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

/// Namespaced by trip, with a random suffix so an uploaded filename is never
/// guessable from the outside.
export async function storeDocument(input: {
  tripId: string;
  file: File;
}) {
  const extension = ALLOWED_DOCUMENT_TYPES.get(input.file.type) ?? "bin";
  const pathname = `trips/${input.tripId}/document.${extension}`;

  const blob = await put(pathname, input.file, {
    access: "private",
    addRandomSuffix: true,
    contentType: input.file.type,
  });

  return { pathname: blob.pathname, size: input.file.size };
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
