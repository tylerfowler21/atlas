import { prisma } from "@/lib/prisma";
import {
  BUILT_IN_CATEGORIES,
  isBuiltInCategory,
  type Category,
} from "@/lib/taxonomy";

/// The categories somebody has made, in the order they chose.
///
/// Never throws. This is read by the layout every signed-in page renders
/// inside, so a failure here is a failure of the whole app — and it has already
/// happened once, in the window between the code shipping and the table
/// existing. Somebody's own categories going missing should cost them their own
/// categories, not the map, the trips and everything else.
export async function userCategories(userId: string): Promise<Category[]> {
  try {
    const rows = await prisma.category.findMany({
      where: { userId },
      orderBy: [{ position: "asc" }, { createdAt: "asc" }],
    });
    return rows.map((r) => ({
      id: r.id,
      label: r.label,
      icon: r.icon,
      color: r.color,
      custom: true,
    }));
  } catch {
    // The built-in categories are a working app on their own.
    return [];
  }
}

/// Every category as this person has it: the ten built-ins with their changes
/// applied, then the ones they made.
///
/// The built-ins keep their ids and their order. Only their appearance moves,
/// so a place filed under "cafe" is still filed under "cafe" whatever it is
/// called or coloured on the screen.
export async function resolvedCategories(userId: string): Promise<Category[]> {
  const [overrides, own] = await Promise.all([
    prisma.categoryOverride.findMany({ where: { userId } }),
    userCategories(userId),
  ]);

  const byId = new Map(overrides.map((o) => [o.categoryId, o]));

  const builtIn = BUILT_IN_CATEGORIES.map((base): Category => {
    const edit = byId.get(base.id);
    if (!edit) return { ...base };
    return {
      id: base.id,
      label: edit.label ?? base.label,
      icon: edit.icon ?? base.icon,
      color: edit.color ?? base.color,
      hidden: edit.hidden,
      // Whether anything about how it looks was changed, which is what the
      // settings screen offers to undo. Hiding alone is not a restyle.
      edited: Boolean(edit.label || edit.icon || edit.color),
    };
  });

  return [...builtIn, ...own];
}

/// The ones worth offering in a picker — everything except what has been
/// hidden. Resolution never uses this: a hidden category still has to render
/// for the places already filed under it.
export function pickable(categories: Category[]) {
  return categories.filter((c) => !c.hidden);
}

/// Where a place should actually land, given what this person has hidden.
///
/// Search results arrive carrying a category the geocoder guessed, and that
/// guess does not know what anybody has hidden. Without this, hiding Bar means
/// never seeing Bar in a picker while bars quietly keep filing themselves under
/// it — hidden, uncountable, and impossible to filter for.
export async function landingCategory(userId: string, id: string) {
  if (!isBuiltInCategory(id)) return id;

  const hidden = await prisma.categoryOverride.findFirst({
    where: { userId, categoryId: id, hidden: true },
    select: { id: true },
  });
  return hidden ? "other" : id;
}

/// Whether this person is allowed to file something under this category.
///
/// Categories are per-person, and the id arrives from the client as a plain
/// string, so without this you could put your places into somebody else's
/// category by pasting its id — harmless on its own, but it would leak the fact
/// that the category exists and quietly break every list that tried to render
/// it.
export async function ownsCategory(userId: string, id: string) {
  if (isBuiltInCategory(id)) return true;
  const found = await prisma.category.findFirst({
    where: { id, userId },
    select: { id: true },
  });
  return found !== null;
}

/// Whether a Prisma failure is the unique index on (userId, label).
///
/// Worth telling apart, because the alternative is reporting every possible
/// failure as "you already have one of those" — which sends somebody off
/// renaming a category when the real problem was the database.
export function isDuplicateName(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code: unknown }).code === "P2002"
  );
}
