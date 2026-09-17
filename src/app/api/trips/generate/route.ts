import { NextResponse } from "next/server";
import { TRIP_STYLE_IDS } from "@/lib/trip-styles";
import { z } from "zod";
import { getCurrentUser } from "@/lib/user";
import { unauthorized } from "@/lib/api";
import { generateItinerary, itineraryToText, modelConfigured } from "@/lib/generate-trip";
import { RUNS_PER_MONTH, noneLeft, recordRun, runsUsedThisMonth } from "@/lib/ai-allowance";

const bodySchema = z.object({
  destination: z.string().trim().min(2).max(120),
  days: z.number().int().min(1).max(14),
  /// How the days are split between cities, when there is more than one.
  ///
  /// A fortnight in Canada is not one itinerary — it is three days in Montreal
  /// and two in Québec, and which is which is the thing only the traveller
  /// knows. Optional: one city is still just a city and a number.
  legs: z
    .array(
      z.object({
        city: z.string().trim().min(2).max(120),
        days: z.number().int().min(1).max(14),
      }),
    )
    .max(8)
    .optional(),
  /// The handful of answers that change an itinerary's shape rather than its
  /// details. Free text covers the details.
  styles: z.array(z.enum(TRIP_STYLE_IDS)).max(TRIP_STYLE_IDS.length).optional(),
  interests: z.string().trim().max(300).nullable().optional(),
  pace: z.enum(["relaxed", "balanced", "packed"]).default("balanced"),
});

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return unauthorized();

  if (!modelConfigured) {
    return NextResponse.json(
      { error: "Trip drafting isn't switched on for this deployment." },
      { status: 503 },
    );
  }

  const parsed = bodySchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Check the details" }, { status: 400 });
  }

  // The same allowance a day with Otto in it spends. One gate, so a second AI
  // feature does not quietly get its own separate five.
  const used = await runsUsedThisMonth(user.id);
  if (used >= RUNS_PER_MONTH) {
    return NextResponse.json({ error: noneLeft }, { status: 429 });
  }

  try {
    const legs = parsed.data.legs?.length ? parsed.data.legs : null;
    // The legs are the truth about length when they are given: asking for four
    // days and splitting them three and two is a contradiction, and the split
    // is the more specific answer.
    const days = legs ? legs.reduce((total, leg) => total + leg.days, 0) : parsed.data.days;
    if (days > 14) {
      return NextResponse.json(
        { error: "That is more than a fortnight — split it into two trips." },
        { status: 400 },
      );
    }

    const { itinerary, usage } = await generateItinerary({
      destination: parsed.data.destination,
      days,
      legs,
      styles: parsed.data.styles ?? [],
      interests: parsed.data.interests?.trim() || null,
      pace: parsed.data.pace,
    });

    const text = itineraryToText(itinerary);

    await recordRun({
      userId: user.id,
      destination: parsed.data.destination,
      days,
      text,
      usage,
    });

    // Also said out loud, where a bad afternoon can be seen without opening
    // the database: a draft that suddenly costs five times what it did is a
    // thing to notice while it is happening.
    console.log(
      `[generate] ${days}d ${parsed.data.destination} — ${usage.inputTokens} in, ${usage.outputTokens} out`,
    );

    return NextResponse.json({
      title: itinerary.title,
      destination: itinerary.destination,
      summary: itinerary.summary,
      /// For the website, which drops it into the box its importer already
      /// reads.
      text,
      /// For the app, which has no such box. The same draft, still structured,
      /// so it does not have to parse prose back into the thing it just was.
      stops: itinerary.stops,
      /// Getting between the cities, for the same reason.
      journeys: itinerary.journeys,
      remaining: RUNS_PER_MONTH - used - 1,
    });
  } catch (error) {
    console.error("[generate] draft failed", error);
    return NextResponse.json(
      { error: "That draft didn't come back. Try again in a moment." },
      { status: 502 },
    );
  }
}
