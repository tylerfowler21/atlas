import type { SearchResult } from "@/lib/types";
import { search as nominatimSearch, toPlaceFields } from "@/lib/nominatim";
import { guessCategory } from "@/lib/taxonomy";
import { photonSearch } from "@/lib/photon";

/// Two geocoders queried together, because they fail differently: Nominatim is
/// precise but refuses misspellings, Photon is forgiving but will confidently
/// offer a gorge in South Africa when you meant one in Switzerland.
///
/// Neither is asked to be authoritative. Results are merged, duplicates
/// collapsed, and when the caller has said which country they mean, matches
/// there are kept and everything else dropped — which is what removes the
/// confident nonsense.

const SAME_PLACE_DEGREES = 0.0008;

function dedupeKey(r: SearchResult) {
  return `${r.name.toLowerCase()}|${r.lat.toFixed(3)}|${r.lng.toFixed(3)}`;
}

function near(a: SearchResult, b: SearchResult) {
  return (
    Math.abs(a.lat - b.lat) < SAME_PLACE_DEGREES &&
    Math.abs(a.lng - b.lng) < SAME_PLACE_DEGREES &&
    a.name.toLowerCase() === b.name.toLowerCase()
  );
}

async function fromNominatim(query: string): Promise<SearchResult[]> {
  const raw = await nominatimSearch(query);
  return raw.map((r) => ({
    id: `osm-${r.place_id}`,
    ...toPlaceFields(r),
    category: guessCategory(r.category, r.type),
    context: r.display_name,
  }));
}

export async function geocode(
  query: string,
  region?: string | null,
): Promise<SearchResult[]> {
  // Region is appended for the lookup as well as used for filtering: it helps
  // both engines rank, and only then narrows what comes back.
  const hinted = region ? `${query}, ${region}` : query;

  const [photon, nominatim] = await Promise.all([
    photonSearch(hinted).catch(() => [] as SearchResult[]),
    fromNominatim(hinted).catch(() => [] as SearchResult[]),
  ]);

  // Nominatim first: when both know a place, its address detail is better.
  const merged: SearchResult[] = [];
  for (const result of [...nominatim, ...photon]) {
    if (merged.some((existing) => near(existing, result))) continue;
    if (merged.some((existing) => dedupeKey(existing) === dedupeKey(result))) continue;
    merged.push(result);
  }

  if (!region) return merged.slice(0, 10);

  // Somewhere in the named country beats anywhere else — but only drop the
  // rest when there is something to prefer, or a typo'd country would leave
  // you with nothing at all.
  const wanted = region.trim().toLowerCase();
  const inRegion = merged.filter(
    (r) =>
      r.country?.toLowerCase() === wanted ||
      r.countryCode?.toLowerCase() === wanted ||
      r.context.toLowerCase().includes(wanted),
  );

  return (inRegion.length > 0 ? inRegion : merged).slice(0, 10);
}
