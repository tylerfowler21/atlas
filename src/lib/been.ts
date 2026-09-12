/// Everywhere you have been, counted and put on the dotted world map.
///
/// Shared by the website and the app, because the one number people repeat
/// about themselves — how many countries they have been to — must not depend
/// on which screen they read it off.
import { beenPlaces, type PlaceLike } from "@/lib/place-groups";

export type BeenPlace = PlaceLike & {
  countryCode?: string | null;
  visitedAt?: string | Date | null;
  livedFrom?: string | null;
};

/// When somebody was somewhere, as a year, or null if they never said.
///
/// `visitedAt` is optional and plenty of places are marked visited without
/// one, which is why an undated place still counts towards the totals and
/// simply has no year to file itself under.
export function yearOf(place: BeenPlace): number | null {
  const when = place.visitedAt ?? place.livedFrom ?? null;
  if (!when) return null;
  const date = when instanceof Date ? when : new Date(when);
  const year = date.getFullYear();
  return Number.isFinite(year) ? year : null;
}

/// The years worth offering as filters: the ones you actually have something
/// in, newest first. No empty years, and no year that is only a gap between
/// two trips.
export function beenYears(places: BeenPlace[]): number[] {
  const years = new Set<number>();
  for (const place of beenPlaces(places)) {
    const year = yearOf(place);
    if (year !== null) years.add(year);
  }
  return [...years].sort((a, b) => b - a);
}

/// Narrowed to one year, or left alone for "all time".
///
/// An undated place is left out of a year rather than swept into the newest
/// one: "2025" should mean the places you said were 2025.
export function inYear<T extends BeenPlace>(places: T[], year: number | null): T[] {
  if (year === null) return places;
  return places.filter((p) => yearOf(p) === year);
}

export type BeenSummary = {
  countries: number;
  cities: number;
  places: number;
  /// ISO-3166 alpha-2, lower case, for lighting the map.
  countryCodes: string[];
};

/// What the headline says.
///
/// Counted from places you have been to, not from everything saved: a country
/// on the wishlist is not a country you have visited, and counting it would
/// make the number wrong in the direction that flatters.
///
/// Countries are counted by name rather than by code, because a place can
/// carry a country without the geocoder having given it a code, and dropping
/// those would quietly undercount. The codes are gathered separately, for the
/// map, which can only work in codes.
export function summarise(places: BeenPlace[], year: number | null = null): BeenSummary {
  const been = inYear(beenPlaces(places), year);

  const countries = new Set<string>();
  const cities = new Set<string>();
  const codes = new Set<string>();

  for (const place of been) {
    const country = place.country?.trim();
    if (country) countries.add(country);

    // Cities repeat across countries — there is a Cambridge in three of them —
    // so a city is only itself alongside its country.
    const city = place.city?.trim();
    if (city) cities.add(`${city}, ${country ?? ""}`);

    const code = place.countryCode?.trim().toLowerCase();
    if (code) codes.add(code);
  }

  return {
    countries: countries.size,
    cities: cities.size,
    places: been.length,
    countryCodes: [...codes].sort(),
  };
}

/// How many trips fall in the year, or all of them for "all time".
///
/// A trip counts for the year it started. One that runs across New Year is
/// remembered as the year it began in, which is how people talk about them.
export function tripsInYear(
  trips: { startDate?: string | null; endDate?: string | null }[],
  year: number | null,
): number {
  if (year === null) return trips.length;
  return trips.filter((trip) => {
    const when = trip.startDate ?? trip.endDate;
    if (!when) return false;
    return new Date(when).getFullYear() === year;
  }).length;
}
