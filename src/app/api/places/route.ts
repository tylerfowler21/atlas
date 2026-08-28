import { NextResponse } from "next/server";
import { ownsCategory } from "@/lib/categories";
import { prisma } from "@/lib/prisma";
import { unauthorized } from "@/lib/api";
import { getCurrentUser } from "@/lib/user";
import { firstIssue, placeCreateSchema } from "@/lib/validation";

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return unauthorized();
  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");
  const category = searchParams.get("category");

  const places = await prisma.place.findMany({
    where: {
      userId: user.id,
      ...(status ? { status } : {}),
      ...(category ? { category } : {}),
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ places });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return unauthorized();
  const parsed = placeCreateSchema.safeParse(await request.json());

  if (!parsed.success) {
    return NextResponse.json({ error: firstIssue(parsed.error) }, { status: 400 });
  }

  // A category id arrives as a plain string, so it is checked against the
  // built-in ones and this person's own before it is stored.
  if (parsed.data.category && !(await ownsCategory(user.id, parsed.data.category))) {
    return NextResponse.json({ error: "No such category" }, { status: 400 });
  }

  const data = parsed.data;
  const place = await prisma.place.create({
    data: {
      ...data,
      userId: user.id,
      // Marking something visited without a date means "visited, at some point".
      visitedAt:
        data.visitedAt ?? (data.status === "visited" ? new Date() : null),
    },
  });

  return NextResponse.json({ place }, { status: 201 });
}
