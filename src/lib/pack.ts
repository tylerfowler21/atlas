import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";

/// What to put in the bag, suggested for one particular trip.
///
/// Otto's other half fills a day and needs tools to do it — it has to read the
/// trip, search a gazetteer, and check what it found is real. This needs none
/// of that. Where the trip goes, when, for how long, and what is already on
/// the list is the whole of the input, so it is one call with a schema on the
/// end rather than an agent with a loop. That makes it a tenth of the price of
/// a day fill and the cheapest thing here that spends tokens at all.
///
/// He proposes and never writes, exactly as he does everywhere else. What
/// comes back is a list of suggestions with checkboxes against them; the ones
/// ticked are added through the route the list already uses. The human stays
/// between the suggestion and the suitcase.

const suggestionSchema = z.object({
  /// A sentence about the trip, not about packing in general. Shown above the
  /// list so somebody can tell at a glance whether he understood where they
  /// are going.
  say: z.string(),
  items: z
    .array(
      z.object({
        /// What to pack, as somebody would write it on a list: "waterproof
        /// jacket", not "outerwear appropriate to the forecast".
        label: z.string(),
        /// Why this trip needs it, in a few words. Dropped for the obvious
        /// ones — a passport needs no argument — and the reason a list is
        /// worth reading when it is not.
        because: z.string().nullable(),
      }),
    )
    .max(20),
});

export type PackingSuggestion = z.infer<typeof suggestionSchema>;

const SYSTEM = `You suggest what to pack for one particular trip.

The whole value is in being specific to this trip. Anybody can write
"passport, charger, toothbrush" — a list that could have been written without
reading where somebody is going is a list that wastes their time.

So: think about where it is, what the weather does there at that time of year,
how long they are going for, and what the itinerary says they will be doing.
Hiking boots for a trip with mountains on it. A modest layer where temples
need shoulders covered. An adapter of the right shape. A dry bag where it
rains sideways.

Rules:
- Never repeat something already on their list.
- Twelve things at most, and fewer is better. A list nobody reads to the end
  is not a list.
- Put the trip-specific things first and the obvious ones last, if at all.
- "because" is for things that need explaining. Leave it null when the reason
  is plain.
- No categories, no headings, no markdown. Just things.
- If the trip says almost nothing — no destination, no dates — say so in
  "say" and suggest little. Guessing produces exactly the generic list this
  exists to avoid.`;

export const packingConfigured = Boolean(process.env["ANTHROPIC_API_KEY"]);

export async function suggestPacking(input: {
  where: string | null;
  startDate: string | null;
  endDate: string | null;
  days: number;
  /// What the itinerary actually has on it, so the suggestions can follow the
  /// trip rather than the destination's reputation.
  doing: string[];
  /// Already on their list, so nothing is offered twice.
  already: string[];
}): Promise<{ suggestion: PackingSuggestion; usage: { inputTokens: number; outputTokens: number } }> {
  const client = new Anthropic();

  const asked = [
    input.where ? `The trip goes to ${input.where}.` : "The trip has no destination written down.",
    input.startDate
      ? `It starts ${input.startDate}${input.endDate ? ` and ends ${input.endDate}` : ""}.`
      : "It has no dates.",
    `It is ${input.days} ${input.days === 1 ? "day" : "days"} long.`,
    input.doing.length > 0
      ? `On the itinerary so far: ${input.doing.slice(0, 40).join(", ")}.`
      : "Nothing is on the itinerary yet.",
    input.already.length > 0
      ? `Already on their packing list, do not repeat these: ${input.already.join(", ")}.`
      : "Their packing list is empty.",
  ].join(" ");

  const response = await client.messages.parse({
    model: "claude-sonnet-5",
    max_tokens: 2000,
    system: SYSTEM,
    messages: [{ role: "user", content: asked }],
    output_config: { format: zodOutputFormat(suggestionSchema) },
  });

  const parsed = response.parsed_output;
  if (!parsed) throw new Error("The packing list came back in a shape we could not read");

  return {
    suggestion: parsed,
    usage: {
      inputTokens: response.usage?.input_tokens ?? 0,
      outputTokens: response.usage?.output_tokens ?? 0,
    },
  };
}
