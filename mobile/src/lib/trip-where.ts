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
