import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/user";
import { prisma } from "@/lib/prisma";
import { firstSteps } from "@/lib/first-steps";
import { unauthorized } from "@/lib/api";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return unauthorized();
  return NextResponse.json(await firstSteps(user.id));
}

/// Puts the list away for good.
export async function DELETE() {
  const user = await getCurrentUser();
  if (!user) return unauthorized();

  await prisma.user.update({
    where: { id: user.id },
    data: { stepsHiddenAt: new Date() },
  });
  return NextResponse.json({ ok: true });
}
