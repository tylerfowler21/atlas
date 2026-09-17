import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/user";
import { unauthorized } from "@/lib/api";
import { tripAccess } from "@/lib/trip-access";
import { RUNS_PER_MONTH, noneLeft, recordRun, runsUsedThisMonth } from "@/lib/ai-allowance";
import { packingConfigured, suggestPacking } from "@/lib/pack";
import { ottoOffered } from "@/lib/admin";
import { isPacking } from "@/lib/resources";
import { tripWhere } from "@/lib/trip-where";
import { dayCount } from "@/lib/trips";

/// Otto, asked what to pack.
///
/// Answers with suggestions, never with a list. What comes back is ticked and
/// added through the route the packing list already uses — the same rule that
/// holds everywhere else he works: the human stays between the suggestion and
/// the thing it would change.
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return unauthorized();
  const { id } = await params;

  if (!packingConfigured) {
    return NextResponse.json({ error: "Otto is not set up on this server." }, { status: 503 });
  }
  // 404 rather than 403, so an unreleased feature is not advertised by
  // refusing to do it.
  if (!ottoOffered(user)) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const access = await tripAccess(id, user);
  if (!access) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const used = await runsUsedThisMonth(user.id);
  if (used >= RUNS_PER_MONTH) {
    return NextResponse.json({ error: noneLeft }, { status: 429 });
  }

  const [items, resources] = await Promise.all([
    prisma.itineraryItem.findMany({
      where: { tripId: id },
      select: { title: true, dayIndex: true, endDayOffset: true },
      orderBy: [{ dayIndex: "asc" }, { position: "asc" }],
    }),
    prisma.tripResource.findMany({
      where: { tripId: id },
      select: { label: true, kind: true },
    }),
  ]);

  const trip = access.trip;

  try {
    const { suggestion, usage } = await suggestPacking({
      where: tripWhere(trip),
      startDate: trip.startDate ? trip.startDate.toISOString().slice(0, 10) : null,
      endDate: trip.endDate ? trip.endDate.toISOString().slice(0, 10) : null,
      days: dayCount(
        {
          startDate: trip.startDate ? trip.startDate.toISOString() : null,
          endDate: trip.endDate ? trip.endDate.toISOString() : null,
        },
        items,
      ),
      doing: items.map((i) => i.title),
      already: resources.filter((r) => isPacking(r.kind)).map((r) => r.label),
    });

    // Recorded after the work, like every other run: one that failed cost the
    // model nothing worth charging for.
    await recordRun({
      userId: user.id,
      destination: trip.title,
      days: 1,
      text: suggestion.items.map((i) => i.label).join(", "),
      usage,
    });

    console.log(
      `[pack] ${trip.title} — ${usage.inputTokens} in, ${usage.outputTokens} out, ` +
        `${suggestion.items.length} suggested`,
    );

    return NextResponse.json({
      say: suggestion.say,
      items: suggestion.items,
      remaining: RUNS_PER_MONTH - used - 1,
    });
  } catch (error) {
    console.error("[pack] failed", error);
    return NextResponse.json(
      { error: "Otto could not think of anything. Try again in a moment." },
      { status: 502 },
    );
  }
}
