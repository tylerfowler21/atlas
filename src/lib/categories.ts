import { prisma } from "@/lib/prisma";
import { isBuiltInCategory, type Category } from "@/lib/taxonomy";

/// The categories somebody has made, in the order they chose.
export async function userCategories(userId: string): Promise<Category[]> {
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
