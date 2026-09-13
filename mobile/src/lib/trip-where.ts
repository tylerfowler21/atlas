/// Mirrored from the website's src/lib/trip-where.ts — edit that copy and run
/// `npm run sync-mirror`. A trip should say where it goes in the same words on
/// both clients.
type Where = {
  destination?: string | null;
  destinations?: string[] | null;
};

/// Every place the trip goes, oldest field included, in order and without
/// repeats.
export function tripRegions(trip: Where): string[] {
  const many = (trip.destinations ?? []).map((d) => d.trim()).filter(Boolean);
  if (many.length > 0) return [...new Set(many)];
  const one = trip.destination?.trim();
  return one ? [one] : [];
}

/// For a line of text under a trip's name. Separated by middots rather than
/// commas because the parts contain commas of their own — "Lucerne,
/// Switzerland · Zermatt, Switzerland" reads; the comma version does not.
export function tripWhere(trip: Where): string | null {
  const regions = tripRegions(trip);
  return regions.length > 0 ? regions.join(" · ") : null;
}

/// What to narrow a place search to.
///
/// One region, because the geocoders behind the search allow about a request a
/// second and asking each of five would spend five of them on one keystroke.
/// The first is the right guess: it is where the trip starts, and it is the
/// one somebody typed first.
export function searchRegionFor(trip: Where): string | null {
  return tripRegions(trip)[0] ?? null;
}

/// Lowercased and stripped of accents, so "Québec" matches "Quebec".
function fold(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .trim();
}

/// The words a trip's destinations are made of. "Porto, Portugal" gives
/// "porto" and "portugal", so a saved place can be checked against them.
export function destinationWords(
  destination: string[] | string | null | undefined,
): string[] {
  const labels = Array.isArray(destination) ? destination : destination ? [destination] : [];
  return [
    ...new Set(
      labels
        .flatMap((label) => label.split(","))
        .map(fold)
        .filter((part) => part.length > 1),
    ),
  ];
}

/// Whether a saved place is somewhere the trip actually goes.
///
/// The idle list under "Add a stop" is a list of suggestions, and the first few
/// places somebody saved in alphabetical order are not suggestions: on a trip
/// to Porto it offered a shop in Tokyo, a walk in Japan, and Amsterdam.
///
/// The country decides it, with the city as the other way in — a destination
/// somebody typed as just "Tokyo" names no country, and matching the city is
/// what makes that one work at all.
export function goesTo(
  place: { city?: string | null; country?: string | null },
  words: string[],
): boolean {
  if (words.length === 0) return true;
  const country = fold(place.country ?? "");
  const city = fold(place.city ?? "");
  return words.some((word) => country === word || city === word);
}
