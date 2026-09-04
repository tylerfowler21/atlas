/// The things you need before a trip rather than during it.
///
/// The kinds are deliberately few. This is a checklist somebody writes on a
/// sofa a week before flying, and a long taxonomy would turn one decision —
/// "have I got this yet?" — into two.
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
