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

/// What goes in the bag, kept in the same table as the things above.
///
/// A packing list is the same shape as a resource — a label, a tick, an order
/// — and giving it its own table would mean a second set of routes, a second
/// reorder, and a second thing to keep working. So it is a kind rather than a
/// model, and the only thing it does not share is the screen: four passes and
/// twenty pairs of socks do not belong in one list, and the question you ask
/// of each is different. "Have I bought this yet" is a week's worth of
/// errands; "have I packed this yet" is the night before.
///
/// Deliberately not in RESOURCE_KINDS: that list is the choices offered when
/// adding something to "Before you go", and packing is not one of them.
export const PACKING_KIND = "pack" as const;

export function isPacking(kind: string | null | undefined) {
  return kind === PACKING_KIND;
}

/// Packing leads, so the tuple's first element is a literal and the type is a
/// non-empty tuple without a cast. Order means nothing to the validator.
export const RESOURCE_KIND_IDS = [PACKING_KIND, ...RESOURCE_KINDS.map((k) => k.id)] as const;

export function resourceKind(id: string | null | undefined) {
  return RESOURCE_KINDS.find((k) => k.id === id) ?? RESOURCE_KINDS[0];
}
