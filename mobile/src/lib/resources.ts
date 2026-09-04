/// Mirrored from the website's src/lib/resources.ts — edit that copy and run
/// `npm run sync-mirror`. A checklist that disagrees with itself between the
/// laptop it was written on and the phone it is read on is worse than none.
export const RESOURCE_KINDS = [
  { id: "app", label: "App", icon: "📱" },
  { id: "pass", label: "Pass or ticket", icon: "🎟️" },
  { id: "doc", label: "Document", icon: "📄" },
  { id: "link", label: "Link", icon: "🔗" },
] as const;

export type ResourceKind = (typeof RESOURCE_KINDS)[number]["id"];

export const RESOURCE_KIND_IDS = RESOURCE_KINDS.map((k) => k.id) as [
  ResourceKind,
  ...ResourceKind[],
];

export function resourceKind(id: string | null | undefined) {
  return RESOURCE_KINDS.find((k) => k.id === id) ?? RESOURCE_KINDS[0];
}
