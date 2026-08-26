import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { unauthorized } from "@/lib/api";
import { getCurrentUser } from "@/lib/user";

/// What has happened that you would want to know about.
///
/// The website renders this page on the server, so nothing served it as data
/// until the app needed it. Denormalised trip titles are stored on the
/// notification itself, so an entry still reads correctly after the trip it
/// mentions is renamed or deleted.
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return unauthorized();

  const notifications = await prisma.notification.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    take: 50,
    include: {
      actor: { select: { name: true, username: true, image: true } },
    },
  });

  return NextResponse.json({
    notifications,
    unread: notifications.filter((n) => !n.readAt).length,
  });
}

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
