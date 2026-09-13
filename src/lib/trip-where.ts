/// Where a trip goes.
///
/// A trip used to have one destination, which is fine for a long weekend in
/// Lisbon and wrong for a fortnight in Switzerland: that one is Lucerne and
/// Interlaken and Zermatt, and flattening it to "Switzerland" throws away the
/// only part a place search can actually use. So a trip now has a list, and
/// the old single field stays as what every trip made before this reads from.
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

/// Four letters is enough to tell Lisboa from Lisbon and Montréal from
/// Montreal, and not enough to confuse two cities anybody would put in one
/// trip.
const PREFIX = 4;

/// Which of a trip's cities a name refers to, or -1.
///
/// The same city, then the first few letters — because a model writing an
/// itinerary for Portugal writes Lisboa where somebody typed Lisbon, and
/// Montréal, Québec, Sevilla and Roma have the same shape.
export function cityIndexFor(name: string, cities: string[]): number {
  const wanted = fold(name);
  if (!wanted) return -1;

  const exact = cities.findIndex((city) => fold(city) === wanted);
  if (exact >= 0) return exact;

  return cities.findIndex((city) => {
    const known = fold(city);
    return (
      known.length >= PREFIX &&
      wanted.length >= PREFIX &&
      known.slice(0, PREFIX) === wanted.slice(0, PREFIX)
    );
  });
}

/// The two ends of a journey, as positions in the trip's list of cities.
///
/// A journey runs from one of the trip's cities to the next, so an end that
/// nothing else could place is the city beside the one that could. That rescues
/// the half-matched case: "Firenze → Rome" against [Florence, Rome] finds Rome
/// by name and Florence by being the one before it.
///
/// It needs one end to hold. "Firenze → Roma" against [Florence, Rome] matches
/// neither and comes back with neither, and a journey to somewhere the trip
/// never named comes back with one. Both are a journey with a missing pin
/// rather than a wrong one, which is the right way round: the itinerary still
/// says where it went, and nothing lands on a map five hundred kilometres from
/// the trip.
export function journeyEnds(
  from: string,
  to: string,
  cities: string[],
): { from: number; to: number } {
  let start = cityIndexFor(from, cities);
  let end = cityIndexFor(to, cities);

  if (end < 0 && start >= 0) end = start + 1;
  if (start < 0 && end >= 0) start = end - 1;

  const real = (i: number) => (i >= 0 && i < cities.length ? i : -1);
  return { from: real(start), to: real(end) };
}
