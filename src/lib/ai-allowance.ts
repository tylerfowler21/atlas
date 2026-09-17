import { prisma } from "@/lib/prisma";

/// One gate for everything that costs model time.
///
/// Drafting a trip and filling a day are the same expense wearing two hats, and
/// an allowance that lives inside whichever route happened to need it first
/// means the next AI feature quietly gets its own separate five. Everything
/// that spends tokens counts against this, and the paywall — when there is one
/// — changes a number here rather than every route that calls a model.

/// What one account may spend in a month.
///
/// A month rather than a day, for two reasons.
///
/// Nobody plans a trip at five runs a day. They plan it on a Sunday evening in
/// one sitting and then do not open the thing for six weeks, so a daily cap
/// stops the only session that mattered and then hands back an allowance
/// nobody wants. A pool fits the shape of the activity: spend it in an evening
/// if that is when the evening is.
///
/// And a day was the wrong unit to price. Five a day is a hundred and fifty a
/// month; at what a run costs, that is an order of magnitude more model time
/// than thirty dollars a year can buy. A ceiling nobody was ever meant to
/// reach is not a limit, it is a liability that happens not to have been
/// claimed yet.
///
/// Thirty is what the arithmetic allows with room to spare, once a run is on
/// Sonnet with its history cached. Re-run `scripts/ai-costs.ts` against real
/// usage before moving it.
export const RUNS_PER_MONTH = 30;

/// The first of the month, UTC — like every other date this app reasons about.
/// A calendar month rather than thirty rolling days for the same reason the
/// day was midnight and not a rolling twenty-four hours: "they come back on
/// the first" is a promise somebody can hold you to, and a rolling window
/// dribbles them back one at a time in a way nobody can predict.
function startOfMonth(now = new Date()) {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

export async function runsUsedThisMonth(userId: string) {
  return prisma.aiDraft.count({
    where: { userId, createdAt: { gte: startOfMonth() } },
  });
}

/// What to say when there is nothing left. Said here so both features say it
/// the same way, and so it stays true if the number changes.
export const noneLeft = `That's ${RUNS_PER_MONTH} this month, which is the limit for now. They come back on the first.`;

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
  usage: { inputTokens: number; outputTokens: number; cachedTokens?: number };
}) {
  await prisma.aiDraft.create({
    data: {
      userId: run.userId,
      destination: run.destination,
      days: run.days,
      itinerary: run.text,
      inputTokens: run.usage.inputTokens,
      outputTokens: run.usage.outputTokens,
      cachedTokens: run.usage.cachedTokens ?? 0,
    },
  });
}
