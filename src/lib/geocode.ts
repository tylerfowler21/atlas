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
  /// Answering someone mid-word rather than someone who has finished typing.
  ///
  /// Only Photon is asked. It is built for half-typed queries and answers in
  /// about a tenth of a second, where Nominatim is held to one request a second
  /// on purpose — and its terms rule out type-ahead besides. Asking it here
  /// would make every suggestion queue behind the last one for no gain: the
  /// thorough search that follows a moment later asks it properly.
  suggest = false,
): Promise<SearchResult[]> {
  // The region is asked for as well as the bare query, never instead of it.
  //
  // Appending it to the query alone means searching for "London, Lisbon,
  // Portugal" the moment somebody looks outside the trip's destination — a
  // phrase no gazetteer knows, which took a search for London from ten results
  // to two. The hint helps when the answer is nearby and must not be able to
  // hide the answer when it is not.
  const queries = region ? [`${query}, ${region}`, query] : [query];

  // Grouped by query rather than flattened, so the ordering below does not
  // depend on counting how many geocoders ran.
  const byQuery = await Promise.all(
    queries.map(async (q) => {
      const [photon, osm] = await Promise.all([
        photonSearch(q).catch(() => [] as SearchResult[]),
        suggest ? [] : fromNominatim(q).catch(() => [] as SearchResult[]),
      ]);
      // Nominatim before Photon: when both know a place, its address is better.
      return [...osm, ...photon];
    }),
  );

  // Hinted results first, so the trip's own region still ranks above the rest.
  const ordered = byQuery;

  const merged: SearchResult[] = [];
  for (const result of ordered.flat()) {
    if (merged.some((existing) => near(existing, result))) continue;
    if (merged.some((existing) => dedupeKey(existing) === dedupeKey(result))) continue;
    merged.push(result);
  }

  if (!region) return merged.slice(0, 10);

  /// Somewhere in the trip's region comes first, and nothing is thrown away.
  ///
  /// Ranking on how exactly a name matched was tried and abandoned: every
  /// weighting that put "London" the city above a tree called "London plane"
  /// in Lisbon also put a "Time Out Market" in New York above "Time Out Market
  /// Lisboa", and the reverse. The two pull opposite ways, and guessing which
  /// one someone meant from the string alone is not a thing this can know.
  ///
  /// So the region decides the order, as it always did, and the fix for the
  /// original complaint is above: both queries are asked, so the answer is
  /// always in the list even when the region does not favour it.
  const parts = region
    .toLowerCase()
    .split(",")
    .map((part) => part.trim())
    .filter((part) => part.length > 1);

  const inRegion = (r: SearchResult) => {
    const country = r.country?.toLowerCase() ?? "";
    const code = r.countryCode?.toLowerCase() ?? "";
    const context = r.context.toLowerCase();
    return parts.some(
      (part) => country === part || code === part || context.includes(part),
    );
  };

  return [...merged]
    .map((r, i) => ({ r: { ...r, nearby: inRegion(r) }, i }))
    // Index keeps it stable, so within each group the engines' own order holds.
    .sort((a, b) => Number(b.r.nearby) - Number(a.r.nearby) || a.i - b.i)
    .map(({ r }) => r)
    // Room for a few elsewhere behind the fold, without the list becoming the
    // gazetteer's entire opinion.
    .slice(0, 12);
}
