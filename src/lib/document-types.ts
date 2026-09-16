/// What counts as a file, and what to call it.
///
/// The half of trip documents that is not about storing anything: which types
/// are allowed, what one weighs, which icon it wears, and the awkward business
/// of working out what a file actually is when the picker will not say.
///
/// Shared with the app because both clients have to agree. They were two hand
/// copies of the same logic until the comments explaining the byte sniffing
/// survived in one and not the other — which is what the mirror exists to
/// stop, and it had already happened by the first afternoon.
///
/// Putting a blob somewhere is a server job and stays next door in
/// trip-documents.ts, which re-exports all of this so nothing that already
/// imported from there has to change.

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
