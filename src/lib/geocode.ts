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

/// Roughly fifty kilometres either side, as degrees. Nominatim is given this
/// as a preference rather than a boundary — `bounded=0` — so somewhere outside
/// it is ranked lower rather than hidden, which matters when the map happens
/// to be pointing somewhere else entirely.
const VIEWBOX_DEGREES = 0.5;

function viewboxAround(centre?: { lat: number; lng: number } | null) {
  if (!centre) return undefined;
  const { lat, lng } = centre;
  return [
    lng - VIEWBOX_DEGREES,
    lat + VIEWBOX_DEGREES,
    lng + VIEWBOX_DEGREES,
    lat - VIEWBOX_DEGREES,
  ].join(",");
}

async function fromNominatim(
  query: string,
  viewbox?: string,
  bounded = false,
): Promise<SearchResult[]> {
  const raw = await nominatimSearch(query, viewbox, bounded);
  return raw.map((r) => ({
    id: `osm-${r.place_id}`,
    ...toPlaceFields(r),
    category: guessCategory(r.category, r.type, r.addresstype),
    context: r.display_name,
  }));
}

export async function geocode(
  query: string,
  /// Where the caller says they are going. A trip goes to several places, and
  /// all of them decide the order — only the first gets a query of its own,
  /// because each extra one costs a second against the geocoder's rate limit
  /// and the ranking below is free.
  region?: string | string[] | null,
  /// Answering someone mid-word rather than someone who has finished typing.
  ///
  /// Only Photon is asked. It is built for half-typed queries and answers in
  /// about a tenth of a second, where Nominatim is held to one request a second
  /// on purpose — and its terms rule out type-ahead besides. Asking it here
  /// would make every suggestion queue behind the last one for no gain: the
  /// thorough search that follows a moment later asks it properly.
  suggest = false,
  /// Where the map is looking, when anything knows. Both geocoders rank by
  /// distance from it, softly: the world is still searched, it just stops
  /// answering "hilton" with a village in County Durham when the map is over
  /// French Polynesia.
  around?: { lat: number; lng: number } | null,
): Promise<SearchResult[]> {
  // The region is asked for as well as the bare query, never instead of it.
  //
  // Appending it to the query alone means searching for "London, Lisbon,
  // Portugal" the moment somebody looks outside the trip's destination — a
  // phrase no gazetteer knows, which took a search for London from ten results
  // to two. The hint helps when the answer is nearby and must not be able to
  // hide the answer when it is not.
  const regions = (Array.isArray(region) ? region : region ? [region] : [])
    .map((r) => r.trim())
    .filter(Boolean);
  const primary = regions[0];
  const queries = primary ? [`${query}, ${primary}`, query] : [query];

  /// What is inside the map's own view, asked for separately and first.
  ///
  /// This is the only hint either geocoder really acts on. Photon takes a
  /// lat/lon and appears to weigh it at nothing; Nominatim's viewbox does
  /// nothing either until it is `bounded`, at which point it answers "hilton"
  /// over French Polynesia with the resort on Moorea instead of a village in
  /// County Durham. So the box is asked as its own restricted query, and what
  /// it finds goes to the top — the unrestricted searches still run, so
  /// nothing outside the view is lost.
  const box = viewboxAround(around);
  const local =
    box && !suggest
      ? await fromNominatim(query, box, true).catch(() => [] as SearchResult[])
      : [];

  // Grouped by query rather than flattened, so the ordering below does not
  // depend on counting how many geocoders ran.
  const byQuery = await Promise.all(
    queries.map(async (q) => {
      const [photon, osm] = await Promise.all([
        photonSearch(q, around).catch(() => [] as SearchResult[]),
        suggest ? [] : fromNominatim(q).catch(() => [] as SearchResult[]),
      ]);
      // Nominatim before Photon: when both know a place, its address is better.
      return [...osm, ...photon];
    }),
  );

  // What the map is looking at first, then the trip's region, then the world.
  const ordered = [local, ...byQuery];

  const merged: SearchResult[] = [];
  for (const result of ordered.flat()) {
    if (merged.some((existing) => near(existing, result))) continue;
    if (merged.some((existing) => dedupeKey(existing) === dedupeKey(result))) continue;
    merged.push(result);
  }

  /// Lowercased and stripped of accents, so "Zürich" answers "zurich".
  const fold = (value: string) =>
    value
      .toLowerCase()
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "")
      .trim();

  /// The words of a name, with the joining scraps dropped.
  ///
  /// Everything that is not a letter or a number separates, so "St-Viateur"
  /// and "St Viateur" come apart the same way and "L'Express" yields the word
  /// that matters. Single characters go: the "l" of "L'Express" and the "s" of
  /// "Schwartz's" are punctuation wearing a hat, and counting them makes two
  /// spellings of one name look like different names.
  const words = (value: string) =>
    fold(value)
      .split(/[^\p{L}\p{N}]+/u)
      .filter((word) => word.length > 1);

  /// What one word is worth against another: the same word, or one that is
  /// still being typed.
  ///
  /// The prefix credit is what answers somebody mid-word — "Ams" is not the
  /// word "Amsterdam" and never will be, and without this it scores nothing
  /// against it. Three letters before it counts, so "a" does not half-match
  /// the world.
  const PREFIX = 0.75;
  const credit = (a: string, b: string) => {
    if (a === b) return 1;
    if (a.length >= 3 && b.startsWith(a)) return PREFIX;
    if (b.length >= 3 && a.startsWith(b)) return PREFIX;
    return 0;
  };

  /// How much of one set of words the other accounts for.
  const covers = (from: string[], against: string[]) =>
    from.length === 0
      ? 0
      : from.reduce(
          (sum, word) => sum + Math.max(0, ...against.map((other) => credit(word, other))),
          0,
        ) / from.length;

  /// How well a name answers what was asked for, both ways round.
  ///
  /// Asking only how much of the query the name covers makes every long name
  /// containing the right word a perfect answer — "Express Union Canada" for
  /// L'Express. Asking only the reverse makes every short name win. A name is
  /// the answer when it accounts for the query *and* the query accounts for
  /// it, so the two are combined the way a harmonic mean combines them: one of
  /// them near zero takes the whole score down with it.
  const similarity = (asked: string[], name: string[]) => {
    const ofAsked = covers(asked, name);
    const ofName = covers(name, asked);
    if (ofAsked + ofName === 0) return 0;
    return (2 * ofAsked * ofName) / (ofAsked + ofName);
  };

  /// What is being looked for, and the hint about which one.
  ///
  /// A stop arrives as "Schwartz's Deli, Montreal": a name, then where it is.
  /// Scoring that whole string against a result's name asks whether anywhere
  /// is called "Schwartz's Deli, Montreal" — nothing is, so everything scored
  /// zero and the engines' own order decided. That order answered Schwartz's
  /// Deli, Le Petit Alep, Paillard, L'Oncle Antoine and Gare du Palais all
  /// with Université du Québec à Montréal: a long generic name wins by default
  /// whenever nothing is really being scored.
  const comma = query.indexOf(",");
  const asked = words(comma === -1 ? query : query.slice(0, comma));
  const hint = comma === -1 ? [] : words(query.slice(comma + 1));

  /// Whether the result is where the query said it was. Only ever a tiebreak
  /// between two places of the same name — the St-Viateur Bagel in Montréal
  /// and the one in Dollard-des-Ormeaux.
  const placed = (r: SearchResult) => {
    if (hint.length === 0) return false;
    const where = fold(`${r.city ?? ""} ${r.country ?? ""} ${r.context}`);
    return hint.some((word) => where.includes(word));
  };

  const parts = regions
    .flatMap((r) => r.toLowerCase().split(","))
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

  /// Somewhere in the trip's region first, then how well the name answers,
  /// then which of two same-named places is in the right town, then the index
  /// — which keeps the sort stable, so the engines break the last tie.
  ///
  /// The region stays the first key. Somewhere you are going is a better
  /// answer than somewhere you are not, even when the name matches less well;
  /// both queries are asked further up, so the answer is in the list either
  /// way.
  const ranked = merged.map((r, i) => {
    const nearby = parts.length > 0 && inRegion(r);
    return {
      r: parts.length > 0 ? { ...r, nearby } : r,
      i,
      nearby,
      score: similarity(asked, words(r.name)),
      placed: placed(r),
    };
  });

  ranked.sort(
    (a, b) =>
      Number(b.nearby) - Number(a.nearby) ||
      b.score - a.score ||
      Number(b.placed) - Number(a.placed) ||
      a.i - b.i,
  );

  // Room for a few elsewhere behind the fold, without the list becoming the
  // gazetteer's entire opinion.
  return ranked.map(({ r }) => r).slice(0, regions.length > 0 ? 12 : 10);
}
