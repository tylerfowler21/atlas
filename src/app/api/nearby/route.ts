import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/user";
import { photonNearby } from "@/lib/photon";
import { unauthorized } from "@/lib/api";

/// What is around a point — for "add wherever I am standing".
///
/// Signed in only. It is not expensive, but it costs somebody else's geocoder a
/// request per call and there is no reason for it to be open.
export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return unauthorized();

  const { searchParams } = new URL(request.url);
  const lat = Number(searchParams.get("lat"));
  const lng = Number(searchParams.get("lng"));

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return NextResponse.json({ error: "Where?" }, { status: 400 });
  }
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) {
    return NextResponse.json({ error: "That isn't on Earth" }, { status: 400 });
  }

  // How far to look. A finger on a map is asking about the thing under it, not
  // about the neighbourhood, so callers doing that ask for a tighter circle
  // than "what is around me".
  const radius = Number(searchParams.get("radius"));
  const km = Number.isFinite(radius) && radius > 0 ? Math.min(radius, 2) : undefined;

  try {
    return NextResponse.json({ results: await photonNearby(lat, lng, km) });
  } catch {
    return NextResponse.json(
      { error: "Couldn't look up what's around you", results: [] },
      { status: 502 },
    );
  }
}
