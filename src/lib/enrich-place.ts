import type { SelectedPlace } from "@/components/map-types";
import type { PlaceDraft } from "@/lib/types";

/// Turns a place tapped on the map into one worth saving.
///
/// Apple gives a name, a coordinate and a category, and nothing about where it
/// is. Saved as-is, a restaurant would have no city and no country — so it
/// would be missing from the city and country counts, and from the drill-down
/// into either. The counts are the number people quote about themselves, and a
/// place that quietly does not count is worse than one that was never saved.
///
/// The lookup is best-effort. Apple's name and category always win: it knows
/// what the thing is called, and the reverse lookup is only being asked which
/// city it stands in.
export async function enrichSelectedPlace(place: SelectedPlace): Promise<PlaceDraft> {
  const base: PlaceDraft = {
    name: place.name,
    lat: place.lat,
    lng: place.lng,
    address: null,
    city: null,
    country: null,
    countryCode: null,
    category: place.category,
  };

  try {
    const res = await fetch(`/api/geocode/reverse?lat=${place.lat}&lng=${place.lng}`);
    if (!res.ok) return base;
    const { result } = (await res.json()) as { result?: Partial<PlaceDraft> };
    if (!result) return base;

    return {
      ...base,
      address: result.address ?? null,
      city: result.city ?? null,
      country: result.country ?? null,
      countryCode: result.countryCode ?? null,
    };
  } catch {
    // Somewhere with no city is still worth saving.
    return base;
  }
}
