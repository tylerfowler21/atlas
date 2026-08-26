import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/user";
import { unauthorized } from "@/lib/api";

/// Records why a page fell back from Apple Maps to the free basemap.
///
/// The fallback is deliberately invisible — a map that looks different rather
/// than a map that is missing — which makes it undiagnosable from outside.
/// MapKit's own reason ("Unauthorized", "Too Many Requests") only exists in the
/// browser, so the browser has to say so.
///
/// Signed in only: Apple Maps is only ever used by signed-in pages, so nobody
/// else has a reason to post here, and it keeps this from being an open write.
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return unauthorized();

  let reason = "unknown";
  try {
    const body = (await request.json()) as { reason?: unknown };
    if (typeof body.reason === "string") reason = body.reason.slice(0, 200);
  } catch {}

  // Shares the diagnostics table rather than adding one; `kind` keeps the two
  // apart, and both answer the same question of "why did that not work".
  await prisma.authError.create({
    data: { kind: "MapKitFallback", message: reason },
  });

  return NextResponse.json({ recorded: true });
}
