/// Mirrored from the website's src/lib/publish-prompt.ts — edit that copy and run
/// `npm run sync:mirror`.

/// Whether to offer to publish a trip, and when.
///
/// Publishing lives as a switch at the bottom of the trip's settings sheet,
/// below the colour and the style, and two accounts in twenty-four have ever
/// found it. That is not a mystery about people; it is what that placement
/// predicts. A switch in a settings sheet asks somebody to remember a feature
/// exists. This asks at the moment the feature is worth something.
///
/// Which moment is the finish line: the dates have passed, there is a real
/// itinerary on it, and the person is looking at the trip rather than at a
/// menu. A half-planned week is not something anybody wants on their profile,
/// and asking about one teaches people to dismiss the question.
///
/// Shared with the app so both ask in the same place. Two answers to "is this
/// finished" is two products.

export type PublishCandidate = {
  publishedAt: string | Date | null;
  /// When the owner said not now. Asked once: an offer repeated every time you
  /// open a trip is not an offer, it is a nag.
  publishAskedAt: string | Date | null;
  endDate: string | Date | null;
};

/// Enough of an itinerary to be worth reading. Three stops is a long
/// afternoon; five is a trip somebody could follow.
export const ENOUGH_STOPS = 5;

export function worthPublishing(
  trip: PublishCandidate,
  stops: number,
  /// Only the owner is asked. A collaborator publishing somebody else's trip
  /// to their own profile is not a thing that should be one tap away.
  owned: boolean,
  now = new Date(),
) {
  if (!owned) return false;
  if (trip.publishedAt) return false;
  if (trip.publishAskedAt) return false;
  if (stops < ENOUGH_STOPS) return false;
  if (!trip.endDate) return false;
  return new Date(trip.endDate) < now;
}
