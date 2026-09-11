/// Mirrored by hand from the website's src/lib/trip-documents.ts — the display
/// half only. Storing a blob is a server job; naming and sizing a file is not,
/// and the two clients should not disagree about what counts as too big.
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
