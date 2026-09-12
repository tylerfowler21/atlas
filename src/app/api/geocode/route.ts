import { NextResponse } from "next/server";
import { geocode } from "@/lib/geocode";
import { getCurrentUser } from "@/lib/user";
import { unauthorized } from "@/lib/api";

/// Signed in only, like nearby. Nominatim is asked one question a second for
/// the whole site, so an open endpoint is one anyone can use to put every
/// signed-in person's search behind their queue.
export async function GET(request: Request) {
  if (!(await getCurrentUser())) return unauthorized();

  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim() ?? "";
  // The country or region the caller is looking in, used to rank and then
  // narrow results.
  const regions = searchParams
    .getAll("region")
    .map((r) => r.trim())
    .filter(Boolean);

  // Type-ahead, which goes to the fast geocoder only and will guess from two
  // letters. Everything else waits for three and asks both.
  const suggest = searchParams.get("suggest") === "1";

  // Where the caller's map is pointing. Only used to ask one extra, restricted
  // question — see the note in geocode() about why a soft hint is worthless.
  const lat = Number(searchParams.get("lat"));
  const lng = Number(searchParams.get("lng"));
  const around =
    Number.isFinite(lat) && Number.isFinite(lng) && (lat !== 0 || lng !== 0)
      ? { lat, lng }
      : null;

  if (q.length < (suggest ? 2 : 3)) return NextResponse.json({ results: [] });

  try {
    const results = await geocode(q, regions, suggest, around);
    return NextResponse.json({ results });
  } catch {
    return NextResponse.json(
      { error: "Place search is unavailable right now", results: [] },
      { status: 502 },
    );
  }
}
