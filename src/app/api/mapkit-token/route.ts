import { NextResponse } from "next/server";
import { mapkitConfigured, mapkitToken } from "@/lib/mapkit";
import { getCurrentUser } from "@/lib/user";
import { unauthorized } from "@/lib/api";

/// Signed-in views use Apple Maps; public share pages keep the free basemap.
/// Requiring a session here is what keeps anonymous traffic off the Apple
/// quota — a shared itinerary can be opened by anyone, including crawlers.
export async function GET(request: Request) {
  if (!mapkitConfigured) {
    return NextResponse.json({ error: "Apple Maps is not configured" }, { status: 404 });
  }

  const user = await getCurrentUser();
  if (!user) return unauthorized();

  const token = await mapkitToken(new URL(request.url).origin);

  return new NextResponse(token, {
    headers: {
      "Content-Type": "text/plain",
      // Shorter than the token's own life, so a cached copy is never handed
      // out close to expiry.
      "Cache-Control": "private, max-age=600",
    },
  });
}
