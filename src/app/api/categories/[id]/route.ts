import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/user";
import { prisma } from "@/lib/prisma";
import { unauthorized } from "@/lib/api";
import { isDuplicateName } from "@/lib/categories";
import { isBuiltInCategory, category as builtIn } from "@/lib/taxonomy";

const patchSchema = z.object({
  /// Only meaningful for the built-in ones: kept out of the pickers.
  hidden: z.boolean().optional(),
  label: z.string().trim().min(1).max(30).optional(),
  icon: z.string().trim().min(1).max(8).optional(),
  color: z
    .string()
    .trim()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .optional(),
  position: z.number().int().min(0).optional(),
});

async function owned(id: string, userId: string) {
  return prisma.category.findFirst({ where: { id, userId } });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return unauthorized();
  const { id } = await params;

  const parsed = patchSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Check the details" }, { status: 400 });
  }

  // A built-in is not a row to update but a row to create: the change is
  // recorded against this person, and the category itself is shared by
  // everybody and stays where it is.
  if (isBuiltInCategory(id)) {
    const { label, icon, color, hidden } = parsed.data;

    if (id === "other" && hidden) {
      return NextResponse.json(
        { error: "Other is where everything else goes — it can't be hidden" },
        { status: 400 },
      );
    }

    const edit = { label, icon, color, ...(hidden === undefined ? {} : { hidden }) };
    const saved = await prisma.categoryOverride.upsert({
      where: { userId_categoryId: { userId: user.id, categoryId: id } },
      update: edit,
      create: { userId: user.id, categoryId: id, ...edit },
    });

    const base = builtIn(id);
    return NextResponse.json({
      category: {
        id,
        label: saved.label ?? base.label,
        icon: saved.icon ?? base.icon,
        color: saved.color ?? base.color,
        hidden: saved.hidden,
        edited: Boolean(saved.label || saved.icon || saved.color),
      },
    });
  }

  if (!(await owned(id, user.id))) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    const category = await prisma.category.update({
      where: { id },
      data: parsed.data,
    });
    return NextResponse.json({ category: { ...category, custom: true } });
  } catch (error) {
    if (isDuplicateName(error)) {
      return NextResponse.json(
        { error: "You already have a category with that name" },
        { status: 409 },
      );
    }
    console.error("[categories] could not update", error);
    return NextResponse.json({ error: "Could not save that" }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return unauthorized();
  const { id } = await params;

  // Deleting a built-in puts it back the way it came, since it is not ours to
  // remove — it is what a search result gets guessed into and what everything
  // unrecognised falls back to. Hiding is the nearest thing to deleting one,
  // and that is a PATCH.
  if (isBuiltInCategory(id)) {
    await prisma.categoryOverride.deleteMany({
      where: { userId: user.id, categoryId: id },
    });
    return NextResponse.json({ ok: true, reset: true });
  }

  // The places keep their pins and move to Other.
  //
  // Deleting a category is tidying up, not throwing places away — nobody
  // expects "I don't use this label any more" to also mean "and lose the
  // twelve restaurants filed under it". Other is where a place with nothing
  // better already lands, so they end up somewhere that renders.
  const [places, items] = await prisma.$transaction([
    prisma.place.updateMany({
      where: { userId: user.id, category: id },
      data: { category: "other" },
    }),
    prisma.itineraryItem.updateMany({
      where: { category: id, trip: { userId: user.id } },
      data: { category: "other" },
    }),
    prisma.category.delete({ where: { id } }),
  ]);

  return NextResponse.json({
    ok: true,
    movedPlaces: places.count,
    movedStops: items.count,
  });
}
