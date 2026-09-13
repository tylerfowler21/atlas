import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import { BUILT_IN_CATEGORY_IDS } from "@/lib/taxonomy";
import { styleAsks } from "@/lib/trip-styles";

/// Asking Claude to draft an itinerary.
///
/// What comes back is a draft, never a saved trip. Every place it names goes
/// through the same review the importer uses: looked up against a real
/// gazetteer, shown with what was found, and confirmed one at a time. That is
/// not ceremony — a language model will happily invent a plausible restaurant,
/// and a place that does not exist simply fails to resolve and says so. The
/// human stays between the suggestion and the map.

export const modelConfigured = Boolean(process.env["ANTHROPIC_API_KEY"]);

const stopSchema = z.object({
  day: z.number().int().min(1).max(30).describe("Which day of the trip, from 1"),
  time: z
    .string()
    .nullable()
    .describe("24-hour time like 09:30, or null if it does not matter"),
  name: z
    .string()
    .describe(
      "The place's actual name, as it is written on the door and on a map. Not a description.",
    ),
  city: z.string().describe("The town or city the place is in"),
  category: z.enum(BUILT_IN_CATEGORY_IDS),
  note: z
    .string()
    .nullable()
    .describe("One short line on why it is worth going, or a booking warning"),
});

const itinerarySchema = z.object({
  title: z.string().describe("A short name for the trip"),
  destination: z.string().describe("The city or region, for looking places up"),
  summary: z.string().describe("Two sentences on the shape of the trip"),
  stops: z.array(stopSchema),
});

export type GeneratedItinerary = z.infer<typeof itinerarySchema>;

const SYSTEM = `You plan travel itineraries that a person will actually follow.

Every place you name must be a real, specific, findable place — the name as it
appears on a map, not a description of an activity. "Café de Flore", not
"a historic café". If you are not confident a place exists and is open, leave it
out; a shorter honest day beats a padded one.

Group stops so a day makes geographic sense: somebody is walking or taking a
train between these, not teleporting. Leave room to eat. Do not fill every hour.

Prefer places that have been there a while over whatever is currently fashionable,
and say in the note when something needs booking ahead.`;

/// The days each city gets, written as the model should read them.
///
/// Numbering the days rather than only naming the cities is the whole point: a
/// model told "Montréal and Québec, five days" writes two and a half of each,
/// and the traveller who said three and two gets neither. Day one of the
/// second city is also the day they travel, which is why it is said out loud.
function legLines(legs: { city: string; days: number }[]): string[] {
  const lines: string[] = [];
  let day = 1;

  for (const [n, leg] of legs.entries()) {
    const last = day + leg.days - 1;
    const when = leg.days === 1 ? `Day ${day}` : `Days ${day}–${last}`;
    lines.push(
      n === 0
        ? `${when}: ${leg.city}.`
        : `${when}: ${leg.city} — they travel there on day ${day}, so that day starts later and lighter.`,
    );
    day = last + 1;
  }

  return lines;
}

export type ItineraryRequest = {
  destination: string;
  days: number;
  /// Where the days go, when the trip is more than one city. Null for a trip
  /// that is just somewhere and a number of days.
  legs?: { city: string; days: number }[] | null;
  /// The kinds of trip somebody picked — see `trip-styles`.
  styles?: string[];
  interests: string | null;
  pace: "relaxed" | "balanced" | "packed";
};

/// What gets asked, separate from the asking — so it can be read without
/// spending a call to find out what it says.
export function draftPrompt(input: ItineraryRequest): string {
  const legs = input.legs?.length ? input.legs : null;

  return [
    legs
      ? [
          `Plan ${input.days} ${input.days === 1 ? "day" : "days"} across ${legs.length} ${legs.length === 1 ? "place" : "places"}, in this order:`,
          ...legLines(legs),
          "Every stop's city must be the city whose days it falls on.",
        ].join("\n")
      : `Plan ${input.days} ${input.days === 1 ? "day" : "days"} in ${input.destination}.`,
    ...styleAsks(input.styles ?? []),
    `Pace: ${input.pace}.`,
    input.interests ? `They are interested in: ${input.interests}.` : null,
    `Aim for ${input.pace === "relaxed" ? "3 or 4" : input.pace === "packed" ? "6 or 7" : "4 or 5"} stops a day, including where to eat.`,
  ]
    .filter(Boolean)
    .join(" ");
}

export async function generateItinerary(input: ItineraryRequest): Promise<GeneratedItinerary> {
  const client = new Anthropic();
  const asked = draftPrompt(input);

  const response = await client.messages.parse({
    model: "claude-opus-5",
    max_tokens: 16000,
    system: SYSTEM,
    thinking: { type: "adaptive" },
    messages: [{ role: "user", content: asked }],
    output_config: { format: zodOutputFormat(itinerarySchema) },
  });

  // Null when the model's output did not satisfy the schema, which the caller
  // reports rather than half-importing.
  const parsed = response.parsed_output;
  if (!parsed) throw new Error("The itinerary came back in a shape we could not read");

  return parsed;
}

/// The draft, written in the format the importer already reads.
///
/// It goes into the same box a pasted itinerary goes into, so the next steps —
/// look each place up, show what was found, confirm or correct it — are the
/// ones that already exist. Nothing about a generated trip skips them.
export function itineraryToText(itinerary: GeneratedItinerary): string {
  const lines: string[] = [];
  let lastDay = 0;

  for (const stop of [...itinerary.stops].sort((a, b) => a.day - b.day)) {
    if (stop.day !== lastDay) {
      lastDay = stop.day;
      lines.push(`Day ${stop.day}`);
    }

    const where =
      stop.city && !stop.name.toLowerCase().includes(stop.city.toLowerCase())
        ? `${stop.name}, ${stop.city}`
        : stop.name;

    // The category leads the note, which is where the importer reads it from.
    const note = [stop.category, stop.note].filter(Boolean).join(", ");
    lines.push(`${stop.time ? `${stop.time} ` : ""}${where}${note ? ` — ${note}` : ""}`);
  }

  return lines.join("\n");
}
