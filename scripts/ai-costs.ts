/// What the drafting has actually cost.
///
/// The point of recording tokens is to answer "what should this cost
/// somebody", and that question is not answered by a table of raw numbers.
/// This reads the drafts, prices them, and says what a heavy month and a quiet
/// month look like per account — which is the shape of the thing a
/// subscription has to cover.
///
/// Drafts made before the counting started read as zero and are left out of
/// the averages rather than dragging them down; the header says how many.
import { prisma } from "../src/lib/db-script";

/// Anthropic's published rates for the model the drafting uses, in dollars per
/// million tokens. Cached from the pricing page on 14 September 2026 — check
/// them against https://www.anthropic.com/pricing before trusting a number
/// this produces to set a price.
const MODEL = "claude-opus-5";
const INPUT_PER_MTOK = 5;
const OUTPUT_PER_MTOK = 25;

function dollars(inputTokens: number, outputTokens: number) {
  return (inputTokens * INPUT_PER_MTOK + outputTokens * OUTPUT_PER_MTOK) / 1_000_000;
}

function money(value: number) {
  return `$${value.toFixed(4)}`;
}

/// The middle one, which describes a typical draft better than the mean does —
/// one fortnight in Japan should not decide what a long weekend looks like.
function median(values: number[]) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[middle - 1]! + sorted[middle]!) / 2 : sorted[middle]!;
}

async function main() {
  const drafts = await prisma.aiDraft.findMany({
    select: {
      userId: true,
      days: true,
      destination: true,
      inputTokens: true,
      outputTokens: true,
      createdAt: true,
    },
    orderBy: { createdAt: "asc" },
  });

  const counted = drafts.filter((d) => d.inputTokens > 0 || d.outputTokens > 0);
  const uncounted = drafts.length - counted.length;

  console.log(`${drafts.length} draft(s) in all, ${counted.length} with tokens recorded`);
  if (uncounted > 0) {
    console.log(`${uncounted} predate the counting and are left out of what follows`);
  }
  if (counted.length === 0) {
    console.log("\nNothing to price yet. Come back once a few drafts have been made.");
    return;
  }

  const costs = counted.map((d) => dollars(d.inputTokens, d.outputTokens));
  const total = costs.reduce((sum, c) => sum + c, 0);

  console.log(`\nPriced at ${MODEL}: $${INPUT_PER_MTOK}/MTok in, $${OUTPUT_PER_MTOK}/MTok out`);
  console.log(`  median draft   ${money(median(costs))}`);
  console.log(`  mean draft     ${money(total / counted.length)}`);
  console.log(`  dearest        ${money(Math.max(...costs))}`);
  console.log(`  cheapest       ${money(Math.min(...costs))}`);
  console.log(`  spent so far   ${money(total)}`);

  console.log(
    `\n  median tokens  ${Math.round(median(counted.map((d) => d.inputTokens)))} in, ` +
      `${Math.round(median(counted.map((d) => d.outputTokens)))} out`,
  );

  /// What it would cost to give somebody the current free allowance every day
  /// for a year. Nobody drafts like that, but it is the ceiling a price has to
  /// survive, and it is the number that decides whether a limit is generous or
  /// reckless.
  const perDraft = median(costs);
  console.log(
    `\n  5 a day for a year would be ${money(perDraft * 5 * 365)} of model time per account`,
  );
  console.log(`  one a week for a year is ${money(perDraft * 52)}`);

  /// Per account, because that is who a subscription is sold to.
  const byUser = new Map<string, number>();
  for (const [i, draft] of counted.entries()) {
    byUser.set(draft.userId, (byUser.get(draft.userId) ?? 0) + costs[i]!);
  }
  console.log(`\nAcross ${byUser.size} account(s):`);
  for (const [userId, spent] of [...byUser].sort((a, b) => b[1] - a[1])) {
    const mine = counted.filter((d) => d.userId === userId);
    console.log(`  ${money(spent)}  over ${mine.length} draft(s)  ${userId}`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
