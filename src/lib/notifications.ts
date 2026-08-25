import { prisma } from "@/lib/prisma";

/// Records something worth telling someone about.
///
/// Deliberately never throws into the caller's path: a notification failing is
/// not a reason for a follow or a copy to fail, and the action the person
/// actually took matters more than the record of it.
export async function notify(input: {
  userId: string;
  kind: "follow" | "copy";
  actorId: string;
  tripId?: string | null;
  tripTitle?: string | null;
}) {
  if (input.userId === input.actorId) return;

  try {
    await prisma.notification.create({
      data: {
        userId: input.userId,
        kind: input.kind,
        actorId: input.actorId,
        tripId: input.tripId ?? null,
        tripTitle: input.tripTitle ?? null,
      },
    });
  } catch (error) {
    console.warn("[notify] could not record a notification", error);
  }
}

export function unreadCount(userId: string) {
  return prisma.notification.count({ where: { userId, readAt: null } });
}
