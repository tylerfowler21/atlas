import { prisma } from "@/lib/prisma";
import type { CurrentUser } from "@/lib/user";

/// "owner" can change trip settings, invite people, share and delete.
/// "editor" can change the itinerary and nothing else.
export type TripRole = "owner" | "editor";

/// Resolves what a signed-in person may do with a trip, and claims any
/// invitation addressed to their email on the way through.
///
/// Returns null when they have no access at all — callers turn that into a 404
/// rather than a 403, so an id cannot be probed for existence.
export async function tripAccess(tripId: string, user: CurrentUser) {
  const trip = await prisma.trip.findUnique({
    where: { id: tripId },
    include: { collaborators: true },
  });
  if (!trip) return null;

  if (trip.userId === user.id) return { trip, role: "owner" as TripRole };

  const email = user.email?.toLowerCase() ?? null;
  const invite = trip.collaborators.find(
    (c) => c.userId === user.id || (email !== null && c.email === email),
  );
  if (!invite) return null;

  // First time this person opens a trip they were invited to by email: bind the
  // invitation to their account so it survives an email change later.
  if (!invite.userId) {
    await prisma.tripCollaborator.update({
      where: { id: invite.id },
      data: { userId: user.id, acceptedAt: new Date() },
    });
  }

  return { trip, role: "editor" as TripRole };
}

/// Trips someone can open: their own, plus any they have been invited to.
export function visibleTripsWhere(user: CurrentUser) {
  const email = user.email?.toLowerCase();
  return {
    OR: [
      { userId: user.id },
      {
        collaborators: {
          some: email
            ? { OR: [{ userId: user.id }, { email }] }
            : { userId: user.id },
        },
      },
    ],
  };
}
