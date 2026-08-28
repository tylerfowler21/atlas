import { prisma } from "@/lib/prisma";
import { isBuiltInCategory, type Category } from "@/lib/taxonomy";

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
