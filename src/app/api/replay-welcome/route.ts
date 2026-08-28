import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/user";
import { prisma } from "@/lib/prisma";
import { unauthorized } from "@/lib/api";

/// Puts the welcome back, so it can be watched again.
///
/// Onboarding is a one-way door by design — nobody wants it twice by accident —
/// which also means the person who built it cannot look at it after the day
/// they signed up. That is the wrong trade for something meant to be improved.
///
/// Nothing is deleted. It clears the two "you have seen this" marks and leaves
/// every place, trip and category alone: the tour runs again over the account
/// that is already there.
export async function POST() {
  const user = await getCurrentUser();
  if (!user) return unauthorized();

  await prisma.user.update({
    where: { id: user.id },
    data: { onboardedAt: null, stepsHiddenAt: null },
  });

  return NextResponse.json({ ok: true });
}
