/// What the app adds to the shared document rules.
///
/// Everything about which files are allowed, what they weigh and what they are
/// called now lives in document-types.ts, mirrored from the website so the two
/// clients cannot drift — they already had, quietly, by losing the comments
/// that explained why the bytes get sniffed at all.
///
/// Re-exported so nothing that imported from here has to change.
export * from "@/lib/document-types";

export function uploadFailureMessage(error: unknown) {
  if (!(error instanceof Error)) return "Try again";
  if (/network connection was lost|failed to fetch|network request failed/i.test(error.message)) {
    return "The connection dropped while sending that file. Try again.";
  }
  return error.message;
}
