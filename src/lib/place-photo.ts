/// Finding a photograph for a saved place, from Wikipedia.
///
/// The design puts a picture on every place, including ones nobody has been to
/// yet — and a place you only want to go to has no journal entry and therefore
/// no photo of its own. Wikipedia covers exactly that case: the famous sight
/// you are planning to see is the kind of thing it has an article and a
/// photograph for.
///
/// Three things this is careful about.
///
/// Being near the place is not enough. In a city almost any article is within
/// a couple of kilometres of any other: searching "Nishiki Market" returned
/// Kyoto City Hall, and "Park Bar" in Toronto returned the Toronto skyline.
/// So the article's title has to actually look like the place's name as well.
/// A photograph of the wrong building is worse than no photograph — it is
/// wrong quietly, and it looks deliberate.
///
/// And the results have to be read in the order the search ranked them.
/// MediaWiki returns them keyed by page id, so walking the object takes them
/// in an order that has nothing to do with relevance; the rank is in `index`.
///
/// And the pictures are other people's work. Most are CC BY-SA, which requires
/// naming the author, so the author and licence come back with the URL and are
/// meant to be shown. A photo whose licence cannot be determined is not used.
const API = "https://en.wikipedia.org/w/api.php";

/// Wikimedia asks for something that identifies the caller and a way to get in
/// touch, and rate-limits anonymous traffic that does not send one.
const AGENT = "Roava/1.0 (https://www.roava.co; hello@roava.co)";

/// How far an article may be from the place and still be about it. Generous
/// enough for a shrine whose article is pinned to its main hall, tight enough
/// to rule out the next neighbourhood.
const NEAR_KM = 3;

export type PlacePhoto = {
  /// A thumbnail URL on upload.wikimedia.org.
  url: string;
  /// The file's description page, where the full licence lives.
  sourceUrl: string;
  /// Ready to print: "Jane Doe, CC BY-SA 4.0".
  attribution: string;
};

function distanceKm(aLat: number, aLng: number, bLat: number, bLng: number) {
  const R = 6371;
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLng = ((bLng - aLng) * Math.PI) / 180;
  const lat1 = (aLat * Math.PI) / 180;
  const lat2 = (bLat * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 + Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return 2 * R * Math.asin(Math.sqrt(h));
}

/// Strips the HTML Wikimedia puts in its credit fields — they arrive as little
/// documents, often a link wrapped around a name.
function plain(html: string | undefined) {
  if (!html) return null;
  const text = html
    .replace(/<[^>]*>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
  return text || null;
}

async function wiki(params: Record<string, string>) {
  const url = `${API}?${new URLSearchParams({ format: "json", origin: "*", ...params })}`;
  const res = await fetch(url, {
    headers: { "User-Agent": AGENT, Accept: "application/json" },
    // Wikipedia's answer for a landmark does not change usefully within a day,
    // and this runs once per place either way.
    next: { revalidate: 86_400 },
  });
  if (!res.ok) throw new Error(`Wikipedia said ${res.status}`);
  return (await res.json()) as Record<string, unknown>;
}

type Page = {
  /// Search rank, 1 upwards. Not the key order.
  index?: number;
  title?: string;
  pageimage?: string;
  thumbnail?: { source?: string };
  coordinates?: { lat: number; lon: number }[];
};

/// Words that carry no identity — they appear in half the place names there
/// are, so agreeing on one of them means nothing.
const NOISE = new Set([
  "the", "a", "an", "of", "and", "at", "in", "on", "de", "du", "la", "le", "el",
  "bar", "cafe", "café", "restaurant", "pub", "hotel", "market", "museum",
  "park", "garden", "gardens", "temple", "shrine", "station", "street", "alley",
]);

/// Folded for comparison: no accents, no punctuation, no case.
function tokens(text: string) {
  return new Set(
    text
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((w) => w.length >= 3 && !NOISE.has(w)),
  );
}

/// Whether an article is plausibly about this place.
///
/// Every distinctive word the place's name has must appear in the article's
/// title, or the other way round — "Fushimi Inari Taisha" and "Fushimi
/// Inari-taisha" agree, "Nishiki Market" and "Kyoto City Hall" do not. One
/// side being a shorter form of the other is normal and fine; sharing a single
/// word out of several is not.
function titlesAgree(placeName: string, articleTitle: string) {
  const a = tokens(placeName);
  const b = tokens(articleTitle);
  if (a.size === 0 || b.size === 0) return false;
  const shared = [...a].filter((w) => b.has(w)).length;
  return shared === Math.min(a.size, b.size);
}

/// The licence and author of one file, or null when either is missing.
async function credit(file: string): Promise<{ attribution: string; sourceUrl: string } | null> {
  const data = await wiki({
    action: "query",
    titles: `File:${file}`,
    prop: "imageinfo",
    iiprop: "extmetadata|url",
    iiextmetadatafilter: "Artist|LicenseShortName|Credit",
  });

  const pages = (data.query as { pages?: Record<string, unknown> } | undefined)?.pages ?? {};
  const page = Object.values(pages)[0] as
    | {
        imageinfo?: {
          descriptionurl?: string;
          extmetadata?: Record<string, { value?: string }>;
        }[];
      }
    | undefined;

  const info = page?.imageinfo?.[0];
  const meta = info?.extmetadata;
  const artist = plain(meta?.Artist?.value) ?? plain(meta?.Credit?.value);
  const licence = plain(meta?.LicenseShortName?.value);
  if (!artist || !licence || !info?.descriptionurl) return null;

  // Some credits are an essay. The card has room for a line.
  const short = artist.length > 60 ? `${artist.slice(0, 57)}…` : artist;
  return { attribution: `${short}, ${licence}`, sourceUrl: info.descriptionurl };
}

export async function findPlacePhoto(place: {
  name: string;
  lat: number;
  lng: number;
  city?: string | null;
}): Promise<PlacePhoto | null> {
  // The city narrows a name that means something everywhere ("Central Market")
  // without excluding one that does not.
  const query = [place.name, place.city].filter(Boolean).join(" ");

  const data = await wiki({
    action: "query",
    generator: "search",
    gsrsearch: query,
    gsrlimit: "5",
    prop: "pageimages|coordinates",
    // "name" is what carries the file name; without it `pageimage` is absent
    // and there is nothing to look a licence up against.
    piprop: "thumbnail|name",
    pithumbsize: "800",
    colimit: "5",
  });

  const pages = (data.query as { pages?: Record<string, Page> } | undefined)?.pages;
  if (!pages) return null;

  const ranked = Object.values(pages).sort(
    (x, y) => (x.index ?? 99) - (y.index ?? 99),
  );

  for (const page of ranked) {
    const thumb = page.thumbnail?.source;
    const at = page.coordinates?.[0];
    if (!thumb || !page.pageimage || !at || !page.title) continue;
    if (distanceKm(place.lat, place.lng, at.lat, at.lon) > NEAR_KM) continue;
    if (!titlesAgree(place.name, page.title)) continue;

    const c = await credit(page.pageimage);
    if (!c) continue;
    return { url: thumb, ...c };
  }
  return null;
}
