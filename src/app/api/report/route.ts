import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/user";
import { firstIssue, reportSchema } from "@/lib/validation";

/// Reporting deliberately does not require an account: a published trip is
/// readable by anyone, so anyone who can see it must be able to report it.
export async function POST(request: Request) {
  const user = await getCurrentUser();

  const parsed = reportSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: firstIssue(parsed.error) }, { status: 400 });
  }
  const { reason, note, username, tripId } = parsed.data;

  const target = username
    ? await prisma.user.findUnique({ where: { username }, select: { id: true } })
    : null;

  if (!target && !tripId) {
    return NextResponse.json({ error: "Nothing to report" }, { status: 400 });
  }

  await prisma.report.create({
    data: {
      reporterId: user?.id ?? null,
      targetUserId: target?.id ?? null,
      tripId: tripId ?? null,
      reason,
      note,
    },
  });

  // Nothing is echoed back about the target: a report should not confirm who
  // or what exists.
  return NextResponse.json({ ok: true }, { status: 201 });
}
