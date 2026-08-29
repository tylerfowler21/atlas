/// Somewhere you have been, counted by city and by country.
///
/// "How many countries have you been to" is the question a travel map exists to
/// answer, and it is answered by naming them rather than by a number — so these
/// are lists you can open, not statistics.
///
/// Only places you have actually been are counted. Somewhere on the wishlist is
/// not a country you have visited, and counting it would make the one number
/// people quote about themselves wrong.
///
/// Shared by the website and the app so the two cannot disagree about a number
/// somebody might repeat out loud.

export type PlaceLike = {
  status: string;
  city?: string | null;
  country?: string | null;
};

export type Group = { name: string; count: number };

const BEEN = new Set(["visited", "lived"]);

export function beenPlaces<T extends PlaceLike>(places: T[]): T[] {
  return places.filter((p) => BEEN.has(p.status));
}

/// Commonest first, then alphabetical, so the order is stable between renders
/// and between the two clients.
function tally(places: PlaceLike[], key: "city" | "country"): Group[] {
  const counted = new Map<string, number>();
  for (const place of places) {
    const value = place[key];
    if (!value) continue;
    counted.set(value, (counted.get(value) ?? 0) + 1);
  }
  return [...counted.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

export function groupPlaces(places: PlaceLike[]) {
  const been = beenPlaces(places);
  const cities = tally(been, "city");
  const countries = tally(been, "country");

  return {
    cities,
    countries,
    counts: {
      total: places.length,
      been: been.length,
      cities: cities.length,
      countries: countries.length,
    },
  };
}

/// Everything in one city or country. The name is matched against both, because
/// the drill-down is one control and "Lisbon" and "Portugal" both arrive
/// through it.
export function within<T extends PlaceLike>(places: T[], name: string): T[] {
  return places.filter((p) => p.city === name || p.country === name);
}

/// Where a trip appears to be, worked out from the stops already on it.
///
/// The destination field is optional and most trips are made without one, so
/// relying on it to narrow a search means the narrowing does not happen for
/// most trips. The stops know: a trip with nine places in Portugal is a trip
/// to Portugal, whatever the field says.
///
/// Deliberately cautious. It answers only when one country holds most of the
/// stops, so a genuinely multi-country trip gets no hint rather than a wrong
/// one, and adds the city only when that city is most of the trip too.
export function tripRegion(
  stops: { city?: string | null; country?: string | null }[],
): string | null {
  const countries = tally(stops.map((s) => ({ status: "visited", ...s })), "country");
  const top = countries[0];
  if (!top) return null;

  const placed = stops.filter((s) => s.country).length;
  // Half is the line: below it, the trip is not really "in" anywhere.
  if (top.count * 2 <= placed) return null;

  const cities = tally(
    stops
      .filter((s) => s.country === top.name)
      .map((s) => ({ status: "visited", ...s })),
    "city",
  );
  const city = cities[0];
  if (city && city.count * 2 > top.count) return `${city.name}, ${top.name}`;

  return top.name;
}
