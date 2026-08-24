import { NextResponse } from "next/server";
import { guessCategory } from "@/lib/taxonomy";
import { search, toPlaceFields } from "@/lib/nominatim";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim() ?? "";
  // Bias results toward what the user is currently looking at.
  const viewbox = searchParams.get("viewbox") ?? undefined;

  if (q.length < 3) return NextResponse.json({ results: [] });

  try {
    const raw = await search(q, viewbox);
    const results = raw.map((r) => ({
      id: String(r.place_id),
      ...toPlaceFields(r),
      category: guessCategory(r.category, r.type),
      context: r.display_name,
    }));
    return NextResponse.json({ results });
  } catch {
    return NextResponse.json(
      { error: "Place search is unavailable right now", results: [] },
      { status: 502 },
    );
  }
}
