import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { unauthorized } from "@/lib/api";
import { getCurrentUser } from "@/lib/user";

/// Marks everything read. Called when the list is opened, since seeing the
/// list is what "read" means here.
export async function POST() {
  const user = await getCurrentUser();
  if (!user) return unauthorized();

  await prisma.notification.updateMany({
    where: { userId: user.id, readAt: null },
    data: { readAt: new Date() },
  });

  return NextResponse.json({ ok: true });
}
