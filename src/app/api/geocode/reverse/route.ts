import { NextResponse } from "next/server";
import { guessCategory } from "@/lib/taxonomy";
import { reverse, toPlaceFields } from "@/lib/nominatim";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const lat = Number(searchParams.get("lat"));
  const lng = Number(searchParams.get("lng"));

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return NextResponse.json({ error: "lat and lng are required" }, { status: 400 });
  }

  try {
    const raw = await reverse(lat, lng);
    const fields = toPlaceFields(raw);
    return NextResponse.json({
      result: {
        ...fields,
        // Trust the pin the user actually dropped over the geocoder's centroid.
        lat,
        lng,
        category: guessCategory(raw.category, raw.type),
      },
    });
  } catch {
    // A dropped pin should still be savable when the lookup fails.
    return NextResponse.json({
      result: { name: "", lat, lng, address: null, city: null, country: null, countryCode: null, category: "other" },
    });
  }
}
