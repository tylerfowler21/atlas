import { prisma } from "@/lib/prisma";

/// One gate for everything that costs model time.
///
/// Drafting a trip and filling a day are the same expense wearing two hats, and
/// an allowance that lives inside whichever route happened to need it first
/// means the next AI feature quietly gets its own separate five. Everything
/// that spends tokens counts against this, and the paywall — when there is one
/// — changes a number here rather than every route that calls a model.

/// What one account may spend in a day, free.
///
/// Every run is a paid call to somebody else's API, and an endpoint that will
/// make one on request is an endpoint that will make a thousand. Worth knowing
/// while choosing this number: a run is not free to us, and five a day for a
/// year is far more model time than a modest subscription covers. The ceiling
/// matters more than the average.
export const RUNS_PER_DAY = 5;

/// Midnight, rather than twenty-four hours ago.
///
/// A rolling window makes "they come back tomorrow" a lie: somebody who spends
/// their allowance across an evening gets it back one at a time through the
/// following evening, and coming back the next morning finds the door still
/// shut. Midnight UTC, like every other date this app reasons about — west of
/// Greenwich that falls in the evening, so the allowance returns earlier than
/// promised rather than later.
function startOfDay(now = new Date()) {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

export async function runsUsedToday(userId: string) {
  return prisma.aiDraft.count({
    where: { userId, createdAt: { gte: startOfDay() } },
  });
}

/// What to say when there is nothing left. Said here so both features say it
/// the same way, and so it stays true if the number changes.
export const noneLeft = `That's ${RUNS_PER_DAY} today, which is the limit for now. They come back tomorrow.`;

/// Recorded after the work is done, never before: a run that failed cost the
/// model nothing worth charging for, and somebody whose day came back empty
/// should not have paid for it.
export async function recordRun(run: {
  userId: string;
  /// Where it was about, for reading back later — a city, or a trip's name.
  destination: string;
  /// How much of a trip it covered. One, for a single day.
  days: number;
  /// What came back, kept so a run survives a closed tab.
  text: string;
  usage: { inputTokens: number; outputTokens: number };
}) {
  await prisma.aiDraft.create({
    data: {
      userId: run.userId,
      destination: run.destination,
      days: run.days,
      itinerary: run.text,
      inputTokens: run.usage.inputTokens,
      outputTokens: run.usage.outputTokens,
    },
  });
}
