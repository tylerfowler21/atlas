import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/user";
import { prisma } from "@/lib/prisma";
import { isDuplicateName, userCategories } from "@/lib/categories";
import { unauthorized } from "@/lib/api";

const bodySchema = z.object({
  label: z.string().trim().min(1).max(30),
  icon: z.string().trim().min(1).max(8),
  /// Hex, because it goes straight into a pin's fill and an inline style.
  color: z
    .string()
    .trim()
    .regex(/^#[0-9a-fA-F]{6}$/, "Pick a colour"),
});

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return unauthorized();
  return NextResponse.json({ categories: await userCategories(user.id) });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return unauthorized();

  const parsed = bodySchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Check the details" }, { status: 400 });
  }

  const last = await prisma.category.findFirst({
    where: { userId: user.id },
    orderBy: { position: "desc" },
    select: { position: true },
  });

  try {
    const category = await prisma.category.create({
      data: { ...parsed.data, userId: user.id, position: (last?.position ?? -1) + 1 },
    });
    return NextResponse.json({
      category: { ...category, custom: true },
    });
  } catch (error) {
    if (isDuplicateName(error)) {
      return NextResponse.json(
        { error: "You already have a category with that name" },
        { status: 409 },
      );
    }
    console.error("[categories] could not create", error);
    return NextResponse.json(
      { error: "Categories are unavailable — the database may need migrating" },
      { status: 500 },
    );
  }
}
