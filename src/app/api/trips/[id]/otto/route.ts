import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { unauthorized } from "@/lib/api";
import { getCurrentUser } from "@/lib/user";
import { tripAccess } from "@/lib/trip-access";
import { firstIssue } from "@/lib/validation";
import { RUNS_PER_DAY, noneLeft, recordRun, runsUsedToday } from "@/lib/ai-allowance";
import { ottoConfigured, runOtto } from "@/lib/otto";
import { ottoOffered } from "@/lib/admin";

/// Otto, asked to fill one day of a trip.
///
/// Answers with a proposal, never with a change. What comes back is a list of
/// entries in exactly the shape `/api/trips/import` accepts, so the client
/// shows them the way it already shows a pasted itinerary and posts the
/// accepted ones back through the importer. This route writes nothing to the
/// trip, which is why an editor may call it as freely as an owner.

const bodySchema = z.object({
  /// Zero-based, as every other day index here is.
  dayIndex: z.number().int().min(0).max(365),
  /// Anything they said. Usually nothing — the day is the brief.
  ask: z.string().trim().max(400).nullable().optional(),
});

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return unauthorized();
  const { id } = await params;

  if (!ottoConfigured) {
    return NextResponse.json({ error: "Otto is not set up on this server." }, { status: 503 });
  }
  // 404 rather than 403, so an unreleased feature is not advertised by
  // refusing to do it.
  if (!ottoOffered(user)) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const access = await tripAccess(id, user);
  if (!access) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const parsed = bodySchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: firstIssue(parsed.error) }, { status: 400 });
  }

  const used = await runsUsedToday(user.id);
  if (used >= RUNS_PER_DAY) {
    return NextResponse.json({ error: noneLeft }, { status: 429 });
  }

  try {
    const result = await runOtto({
      tripId: id,
      // The owner's places, not the caller's. An editor filling a day of
      // somebody else's trip should be offered the places that trip is built
      // from, and has no business being shown their own.
      ownerId: access.trip.userId,
      dayIndex: parsed.data.dayIndex,
      ask: parsed.data.ask ?? null,
    });

    // Nothing found is not a failure, but it is not worth charging for either.
    if (result.entries.length > 0) {
      await recordRun({
        userId: user.id,
        destination: access.trip.title,
        days: 1,
        text: result.say,
        usage: result.usage,
      });
    }

    // Said out loud as well, so a run that suddenly costs five times what it
    // did is visible while it is happening rather than at the end of the month.
    console.log(
      `[otto] day ${parsed.data.dayIndex + 1} of ${access.trip.title} — ` +
        `${result.turns} turns, ${result.usage.inputTokens} in, ${result.usage.outputTokens} out, ` +
        `${result.entries.length} proposed`,
    );

    return NextResponse.json({
      say: result.say,
      entries: result.entries,
      remaining: RUNS_PER_DAY - used - (result.entries.length > 0 ? 1 : 0),
    });
  } catch (error) {
    console.error("[otto] run failed", error);
    return NextResponse.json(
      { error: "Otto could not finish that. Try again in a moment." },
      { status: 502 },
    );
  }
}

/// Reading what he last said about this trip, so a proposal survives a closed
/// tab the way a draft does.
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return unauthorized();
  const { id } = await params;

  const access = await tripAccess(id, user);
  if (!access) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const used = await runsUsedToday(user.id);
  const last = await prisma.aiDraft.findFirst({
    where: { userId: user.id, destination: access.trip.title },
    orderBy: { createdAt: "desc" },
    select: { itinerary: true, createdAt: true },
  });

  return NextResponse.json({
    /// Whether to offer him at all. A plain answer rather than a 404, because
    /// the client asks this in order to decide whether to draw him.
    available: ottoOffered(user),
    remaining: Math.max(0, RUNS_PER_DAY - used),
    lastSaid: last?.itinerary ?? null,
    lastAt: last?.createdAt ?? null,
  });
}
