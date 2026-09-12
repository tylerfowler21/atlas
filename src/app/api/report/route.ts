import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/user";
import { firstIssue, reportSchema } from "@/lib/validation";

/// How many anonymous reports an hour before the door closes for a bit. Real
/// reporting is a handful a day; anything near this is a script.
const ANONYMOUS_PER_HOUR = 50;

/// Reporting deliberately does not require an account: a published trip is
/// readable by anyone, so anyone who can see it must be able to report it.
export async function POST(request: Request) {
  const user = await getCurrentUser();

  // ponytail: one count per anonymous report, no per-IP bookkeeping. A
  // per-address limit needs somewhere to keep addresses; add one if this is
  // ever actually hit.
  if (!user) {
    const recent = await prisma.report.count({
      where: { reporterId: null, createdAt: { gte: new Date(Date.now() - 60 * 60 * 1000) } },
    });
    if (recent >= ANONYMOUS_PER_HOUR) {
      return NextResponse.json({ error: "Try again later" }, { status: 429 });
    }
  }

  const parsed = reportSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: firstIssue(parsed.error) }, { status: 400 });
  }
  const { reason, note, username, tripId } = parsed.data;

  const target = username
    ? await prisma.user.findUnique({ where: { username }, select: { id: true } })
    : null;

  // Only a trip anyone can see can be reported by anyone. A made-up id is
  // not a report, it is a row; and the same answer for "no such trip" and
  // "not published" keeps a private trip's existence unconfirmed.
  const trip = tripId
    ? await prisma.trip.findFirst({
        where: { id: tripId, publishedAt: { not: null } },
        select: { id: true },
      })
    : null;

  if (!target && !trip) {
    return NextResponse.json({ error: "Nothing to report" }, { status: 400 });
  }

  await prisma.report.create({
    data: {
      reporterId: user?.id ?? null,
      targetUserId: target?.id ?? null,
      tripId: trip?.id ?? null,
      reason,
      note,
    },
  });

  // Nothing is echoed back about the target: a report should not confirm who
  // or what exists.
  return NextResponse.json({ ok: true }, { status: 201 });
}
