import { NextResponse } from "next/server";
import { geocode } from "@/lib/geocode";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim() ?? "";
  // The country or region the caller is looking in, used to rank and then
  // narrow results.
  const region = searchParams.get("region")?.trim() || null;

  // Type-ahead, which goes to the fast geocoder only and will guess from two
  // letters. Everything else waits for three and asks both.
  const suggest = searchParams.get("suggest") === "1";

  if (q.length < (suggest ? 2 : 3)) return NextResponse.json({ results: [] });

  try {
    const results = await geocode(q, region, suggest);
    return NextResponse.json({ results });
  } catch {
    return NextResponse.json(
      { error: "Place search is unavailable right now", results: [] },
      { status: 502 },
    );
  }
}
