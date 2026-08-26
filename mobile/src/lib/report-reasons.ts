/// MIRRORED from ../../../src/lib/report-reasons.ts. The reasons offered in
/// the app must match the ones the API accepts, or a report is refused after
/// someone has already decided to make one.

export const REPORT_REASONS = [
  { id: "spam", label: "Spam or advertising" },
  { id: "harassment", label: "Harassment or bullying" },
  { id: "hate", label: "Hate speech" },
  { id: "sexual", label: "Sexual or explicit content" },
  { id: "violence", label: "Violence or dangerous content" },
  { id: "impersonation", label: "Impersonation" },
  { id: "other", label: "Something else" },
] as const;

export const REPORT_REASON_IDS = REPORT_REASONS.map((r) => r.id) as [string, ...string[]];
