import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import { BUILT_IN_CATEGORY_IDS, TRAVEL_MODE_IDS, type BuiltInCategoryId } from "@/lib/taxonomy";
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

/// What the model called it, in the words this app files things under.
///
/// A draft used to die on this. The category was asked for as a strict list,
/// and a model writing up three days in Florence reaches for "museum",
/// "church", "landmark" — true words, none of them on the list — which failed
/// the whole response and threw away sixteen good stops along with the six odd
/// labels. One wrong word should cost one wrong word.
///
/// So the list is asked for in the description and enforced here instead,
/// where an unknown answer is a thing to interpret rather than a thing to
/// refuse. Anything still unrecognised becomes Other, which is what somebody
/// filing it by hand would do.
const CATEGORY_SYNONYMS: Record<string, BuiltInCategoryId> = {
  museum: "sight",
  gallery: "sight",
  church: "sight",
  cathedral: "sight",
  basilica: "sight",
  temple: "sight",
  shrine: "sight",
  castle: "sight",
  palace: "sight",
  monument: "sight",
  landmark: "sight",
  ruins: "sight",
  viewpoint: "sight",
  bridge: "sight",
  square: "sight",
  park: "nature",
  garden: "nature",
  beach: "nature",
  lake: "nature",
  mountain: "nature",
  hike: "nature",
  trail: "nature",
  walk: "nature",
  market: "shop",
  bakery: "cafe",
  "coffee shop": "cafe",
  coffee: "cafe",
  gelato: "cafe",
  "ice cream": "cafe",
  pub: "bar",
  wine: "bar",
  winery: "bar",
  enoteca: "bar",
  brewery: "bar",
  nightlife: "bar",
  food: "restaurant",
  dining: "restaurant",
  trattoria: "restaurant",
  osteria: "restaurant",
  tour: "activity",
  experience: "activity",
  class: "activity",
  workshop: "activity",
  show: "activity",
  theatre: "activity",
  theater: "activity",
  accommodation: "hotel",
  stay: "hotel",
  lodging: "hotel",
  airport: "transport",
  station: "transport",
  train: "transport",
  flight: "transport",
  town: "city",
  village: "city",
  neighbourhood: "city",
  neighborhood: "city",
};

export function nearestCategory(value: string): BuiltInCategoryId {
  const asked = value.trim().toLowerCase();
  if ((BUILT_IN_CATEGORY_IDS as readonly string[]).includes(asked)) {
    return asked as BuiltInCategoryId;
  }
  const known = CATEGORY_SYNONYMS[asked];
  if (known) return known;
  // "art museum", "historic church", "wine bar" — the useful word is in there
  // somewhere. Real category names are looked for before synonyms, so "wine
  // bar" lands on bar rather than on what wine alone would suggest.
  const words = asked.split(/[^a-z]+/).filter(Boolean);
  for (const word of words) {
    if ((BUILT_IN_CATEGORY_IDS as readonly string[]).includes(word)) {
      return word as BuiltInCategoryId;
    }
  }
  for (const word of words) {
    const synonym = CATEGORY_SYNONYMS[word];
    if (synonym) return synonym;
  }
  return "other";
}

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
  category: z
    .string()
    .describe(
      `One of: ${BUILT_IN_CATEGORY_IDS.join(", ")}. Use other if none of them fit.`,
    ),
  note: z
    .string()
    .nullable()
    .describe("One short line on why it is worth going, or a booking warning"),
});

/// Getting from one city to the next.
///
/// A multi-city trip is not two lists of days side by side — there is a morning
/// on a train in the middle of it, and a plan that leaves it out has somebody
/// teleporting between breakfast and lunch. The app has always been able to
/// hold a journey; the draft simply never produced one.
const journeySchema = z.object({
  day: z.number().int().min(1).max(30).describe("Which day of the trip it happens on, from 1"),
  from: z.string().describe("The city being left, as it is written on a map"),
  to: z.string().describe("The city being arrived at"),
  mode: z.enum(TRAVEL_MODE_IDS),
  departs: z.string().nullable().describe("24-hour time like 09:15, or null if it does not matter"),
  arrives: z.string().nullable().describe("24-hour time like 12:30, or null"),
  note: z
    .string()
    .nullable()
    .describe("One short line — which station, how long it takes, whether to book"),
});

const itinerarySchema = z.object({
  title: z.string().describe("A short name for the trip"),
  destination: z.string().describe("The city or region, for looking places up"),
  summary: z.string().describe("Two sentences on the shape of the trip"),
  stops: z.array(stopSchema),
  /// Empty for a trip that never leaves one city.
  journeys: z.array(journeySchema),
});

export type GeneratedItinerary = z.infer<typeof itinerarySchema>;

/// What one draft cost to produce.
///
/// Recorded on every draft because the answer to "what should this cost
/// somebody" is not guessable: the model is billed per token, a fortnight in
/// Japan is not the same size as a long weekend, and thinking tokens are
/// counted as output. A few weeks of real rows answers it; an estimate does
/// not.
///
/// Nothing is cached on the way in yet, so the input count is the whole input.
/// If a cached prefix is ever added, cache reads are billed differently and
/// will need counting separately rather than folded in here.
export type DraftUsage = { inputTokens: number; outputTokens: number };

export type DraftedItinerary = { itinerary: GeneratedItinerary; usage: DraftUsage };

const SYSTEM = `You plan travel itineraries that a person will actually follow.

Every place you name must be a real, specific, findable place — the name as it
appears on a map, not a description of an activity. "Café de Flore", not
"a historic café". If you are not confident a place exists and is open, leave it
out; a shorter honest day beats a padded one.

Group stops so a day makes geographic sense: somebody is walking or taking a
train between these, not teleporting. Leave room to eat. Do not fill every hour.

When the trip moves from one city to the next, say so as a journey: which day,
what it is — train, bus, plane, ferry, car — and roughly when it leaves and
lands. A day somebody spends travelling holds fewer stops than a day they do
not.

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

export async function generateItinerary(input: ItineraryRequest): Promise<DraftedItinerary> {
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

  // Filed under what this app understands, whatever words came back.
  return {
    itinerary: {
      ...parsed,
      stops: parsed.stops.map((stop) => ({ ...stop, category: nearestCategory(stop.category) })),
    },
    usage: {
      inputTokens: response.usage?.input_tokens ?? 0,
      outputTokens: response.usage?.output_tokens ?? 0,
    },
  };
}

/// The draft, written in the format the importer already reads.
///
/// It goes into the same box a pasted itinerary goes into, so the next steps —
/// look each place up, show what was found, confirm or correct it — are the
/// ones that already exist. Nothing about a generated trip skips them.
export function itineraryToText(itinerary: GeneratedItinerary): string {
  /// Stops and journeys in one stream, so a day reads in the order it happens
  /// rather than as a list of places with the travel bolted on the end.
  const lines: { day: number; at: string; text: string }[] = [];

  for (const stop of itinerary.stops) {
    const where =
      stop.city && !stop.name.toLowerCase().includes(stop.city.toLowerCase())
        ? `${stop.name}, ${stop.city}`
        : stop.name;

    // The category leads the note, which is where the importer reads it from.
    const note = [stop.category, stop.note].filter(Boolean).join(", ");
    lines.push({
      day: stop.day,
      at: stop.time ?? "",
      text: `${stop.time ? `${stop.time} ` : ""}${where}${note ? ` — ${note}` : ""}`,
    });
  }

  /// A journey, written the way the importer reads one: two places with an
  /// arrow between them, and the mode at the front of the note where a
  /// category would be.
  for (const leg of itinerary.journeys) {
    const note = [
      leg.mode,
      leg.arrives ? `arrives ${leg.arrives}` : null,
      leg.note,
    ]
      .filter(Boolean)
      .join(", ");
    lines.push({
      day: leg.day,
      // Sorted to the front of its day when nothing says otherwise: the
      // morning train is how the day starts.
      at: leg.departs ?? "",
      text: `${leg.departs ? `${leg.departs} ` : ""}${leg.from} → ${leg.to} — ${note}`,
    });
  }

  const out: string[] = [];
  let lastDay = 0;

  // By day, then by the clock. Anything untimed goes after what is timed,
  // because a day with times in it is a day somebody is reading in order.
  for (const line of lines.sort(
    (a, b) => a.day - b.day || (a.at || "99:99").localeCompare(b.at || "99:99"),
  )) {
    if (line.day !== lastDay) {
      lastDay = line.day;
      out.push(`Day ${line.day}`);
    }
    out.push(line.text);
  }

  return out.join("\n");
}
