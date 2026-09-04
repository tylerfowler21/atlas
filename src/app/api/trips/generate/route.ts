import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/user";
import { prisma } from "@/lib/prisma";
import { unauthorized } from "@/lib/api";
import { generateItinerary, itineraryToText, modelConfigured } from "@/lib/generate-trip";

/// What one account may draft in a day.
///
/// Every generation is a paid call to somebody else's API, and an endpoint that
/// will run one on request is an endpoint that will run a thousand. This is the
/// free allowance; it is also the shape of the thing to sell, if drafting turns
/// out to be worth paying for.
const DRAFTS_PER_DAY = 5;

const bodySchema = z.object({
  destination: z.string().trim().min(2).max(120),
  days: z.number().int().min(1).max(14),
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

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const used = await prisma.aiDraft.count({
    where: { userId: user.id, createdAt: { gte: since } },
  });
  if (used >= DRAFTS_PER_DAY) {
    return NextResponse.json(
      {
        error: `That's ${DRAFTS_PER_DAY} drafts today, which is the limit for now. They come back tomorrow.`,
      },
      { status: 429 },
    );
  }

  try {
    const itinerary = await generateItinerary({
      destination: parsed.data.destination,
      days: parsed.data.days,
      interests: parsed.data.interests?.trim() || null,
      pace: parsed.data.pace,
    });

    const text = itineraryToText(itinerary);

    await prisma.aiDraft.create({
      data: {
        userId: user.id,
        destination: parsed.data.destination,
        days: parsed.data.days,
        itinerary: text,
      },
    });

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
      remaining: DRAFTS_PER_DAY - used - 1,
    });
  } catch (error) {
    console.error("[generate] draft failed", error);
    return NextResponse.json(
      { error: "That draft didn't come back. Try again in a moment." },
      { status: 502 },
    );
  }
}
