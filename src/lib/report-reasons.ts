/// Kept apart from the moderation helpers deliberately: those need Prisma, and
/// the report form is a client component. Importing one from the other pulled
/// the database driver into the browser bundle.

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
