import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import { BUILT_IN_CATEGORY_IDS } from "@/lib/taxonomy";

/// Pulling the places out of a caption somebody wrote for a video.
///
/// A travel reel's caption is a list written for humans: emoji, hashtags, "📍
/// 3. Time Out Market — get the prego". The names are in there; the structure
/// is not. This asks for the names and nothing else.
///
/// What comes back is a list of candidates, never saved places. Each one goes
/// through the same lookup and confirmation the document importer uses, which
/// is what stops a misread hashtag becoming a pin on somebody's map.

const foundSchema = z.object({
  name: z
    .string()
    .describe(
      "The place's actual name as it would be written on a map or a sign. Not a description, not a hashtag.",
    ),
  city: z
    .string()
    .nullable()
    .describe("The town or city, if the caption says or clearly implies it"),
  category: z.enum(BUILT_IN_CATEGORY_IDS),
  note: z
    .string()
    .nullable()
    .describe("What the caption said about it, in one short line, in its own words"),
});

const captionSchema = z.object({
  /// Where the whole list is, when the caption makes it obvious. It narrows
  /// the lookups that follow, which is the difference between finding a café
  /// in Lisbon and one of forty with the same name.
  region: z
    .string()
    .nullable()
    .describe("The city or country the whole list is about, if it is clear"),
  places: z.array(foundSchema),
});

export type CaptionPlaces = z.infer<typeof captionSchema>;

const SYSTEM = `You pull place names out of the caption of a travel video.

Return only places a map would know: restaurants, bars, hotels, museums,
beaches, viewpoints, neighbourhoods. A name written on a door or a sign.

Do not return:
- hashtags, handles, or the video's own marketing ("follow for more")
- generic advice that names nowhere ("get there early", "bring cash")
- a place you are inferring rather than reading. If the caption does not name
  it, it is not there. An empty list is a correct answer.

Captions are written in a hurry, with emoji and numbering and line breaks in
odd places. Read through that to the names. Where the caption says something
about a place — what to order, when to go — keep it as the note, in the
caption's own words rather than your summary of them.`;

export async function placesFromCaption(caption: string): Promise<CaptionPlaces> {
  const client = new Anthropic();

  const response = await client.messages.parse({
    model: "claude-opus-5",
    max_tokens: 4000,
    system: SYSTEM,
    messages: [{ role: "user", content: caption }],
    output_config: { format: zodOutputFormat(captionSchema) },
  });

  const parsed = response.parsed_output;
  if (!parsed) throw new Error("That caption came back in a shape we could not read");
  return parsed;
}

/// The importer's own format, so a caption arrives in the box looking like
/// anything else somebody might paste and goes through the identical review.
export function captionToText(found: CaptionPlaces): string {
  return found.places
    .map((p) => {
      const where = p.city && !p.name.includes(p.city) ? `${p.name}, ${p.city}` : p.name;
      const notes = [p.category, p.note].filter(Boolean).join(", ");
      return notes ? `${where} — ${notes}` : where;
    })
    .join("\n");
}
