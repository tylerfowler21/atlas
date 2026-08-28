import { NextResponse } from "next/server";
import { mapkitConfigured, mapkitToken } from "@/lib/mapkit";
import { getCurrentUser } from "@/lib/user";
import { unauthorized } from "@/lib/api";
import { prisma } from "@/lib/prisma";

/// Records why a token was refused.
///
/// The page cannot report this itself: with no session its report would be
/// refused for the same reason the token was. And the refusal is invisible
/// otherwise — the map simply draws the free basemap, which is what it does
/// when everything is working correctly too.
async function noteRefusal(reason: string) {
  await prisma.authError
    .create({ data: { kind: "MapKitFallback", message: reason } })
    .catch(() => {});
}

/// Signed-in views use Apple Maps; public share pages keep the free basemap.
/// Requiring a session here is what keeps anonymous traffic off the Apple
/// quota — a shared itinerary can be opened by anyone, including crawlers.
export async function GET(request: Request) {
  if (!mapkitConfigured) {
    await noteRefusal("token refused: Apple Maps is not configured (404)");
    return NextResponse.json({ error: "Apple Maps is not configured" }, { status: 404 });
  }

  const user = await getCurrentUser();
  if (!user) {
    await noteRefusal("token refused: no session on the request (401)");
    return unauthorized();
  }

  let token: string;
  try {
    token = await mapkitToken(new URL(request.url).origin);
  } catch (e) {
    // Signing can throw — a private key that will not parse is the usual
    // reason — and an uncaught throw was the one path here that recorded
    // nothing at all. A map that silently used the free basemap while this
    // endpoint returned 500 had no trace anywhere, which is how it stayed
    // unexplained.
    const reason = e instanceof Error ? e.message : "unknown error";
    await noteRefusal(`token could not be signed: ${reason}`);
    return NextResponse.json({ error: "Could not sign a map token" }, { status: 500 });
  }

  return new NextResponse(token, {
    headers: {
      "Content-Type": "text/plain",
      // Never cached. The client also uses this endpoint to decide whether
      // Apple Maps is available at all, and a cached 200 from a deployment
      // that has since lost its credentials picks a map that cannot load.
      "Cache-Control": "no-store",
    },
  });
}
