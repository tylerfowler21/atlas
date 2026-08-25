import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { unauthorized } from "@/lib/api";
import { getCurrentUser } from "@/lib/user";
import { firstIssue, memoryUpdateSchema } from "@/lib/validation";

async function loadOwned(id: string, userId: string) {
  const memory = await prisma.memory.findUnique({ where: { id } });
  return memory && memory.userId === userId ? memory : null;
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return unauthorized();
  const { id } = await params;

  if (!(await loadOwned(id, user.id))) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const parsed = memoryUpdateSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: firstIssue(parsed.error) }, { status: 400 });
  }

  const memory = await prisma.memory.update({
    where: { id },
    data: parsed.data,
    include: {
      place: { select: { id: true, name: true, city: true, country: true } },
      trip: { select: { id: true, title: true } },
    },
  });

  return NextResponse.json({ memory });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return unauthorized();
  const { id } = await params;

  if (!(await loadOwned(id, user.id))) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await prisma.memory.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
