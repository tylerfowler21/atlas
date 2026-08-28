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
