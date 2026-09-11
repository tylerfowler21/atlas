/// What the map is currently looking at, and which saved places are in it.
///
/// The list beside the map answers "what is here", so it follows the map
/// rather than listing everything you have ever saved. Panning to Kyoto should
/// give you Kyoto without anyone having to choose Kyoto from a menu.
export type Bounds = {
  north: number;
  south: number;
  east: number;
  west: number;
  /// The wider of the two deltas, in degrees. Used to decide when the view is
  /// too broad to be "somewhere" at all.
  span: number;
};

/// Wider than this and the view is not a place any more — it is a hemisphere,
/// and naming it after the city nearest the middle would be a lie. Roughly a
/// large country across.
export const WORLD_SPAN = 12;

type Located = { lat: number; lng: number; city?: string | null; country?: string | null };

/// Longitude wraps, so a view crossing the antimeridian has its east edge
/// numerically west of its west edge. Both halves count as inside.
function withinLng(lng: number, west: number, east: number) {
  return west <= east ? lng >= west && lng <= east : lng >= west || lng <= east;
}

export function inView(place: Located, bounds: Bounds) {
  return (
    place.lat <= bounds.north &&
    place.lat >= bounds.south &&
    withinLng(place.lng, bounds.west, bounds.east)
  );
}

/// What to call the stretch of world on screen.
///
/// Named after what is actually in view rather than after the map's centre: the
/// centre of a view of Kyoto can easily be a field between two of its places,
/// and reverse-geocoding it would be a request per pan to learn a name the
/// places already know.
///
/// A city only gets to name the view if most of what is in view is in it —
/// otherwise the country does, and failing that nothing does, and the heading
/// falls back to counting.
export function viewName(places: Located[], bounds: Bounds | null): string | null {
  if (!bounds || bounds.span > WORLD_SPAN) return null;
  if (places.length === 0) return null;

  const tally = (key: (p: Located) => string | null | undefined) => {
    const counts = new Map<string, number>();
    for (const p of places) {
      const value = key(p)?.trim();
      if (value) counts.set(value, (counts.get(value) ?? 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1])[0] ?? null;
  };

  const city = tally((p) => p.city);
  if (city && city[1] / places.length >= 0.6) return city[0];

  const country = tally((p) => p.country);
  if (country && country[1] / places.length >= 0.6) return country[0];

  return null;
}

/// The line under the heading: where this is, and how much of it you have
/// saved. Kept separate from the name so the two can be styled apart.
export function viewSubtitle(
  places: Located[],
  name: string | null,
  total: number,
): string {
  const saved = `${places.length} ${places.length === 1 ? "place" : "places"} saved`;
  if (!name) return total > places.length ? `${saved} of ${total}` : saved;

  // When the heading is already the city, the line under it can carry the
  // country; when the heading is the country, repeating it says nothing.
  const country = places.find((p) => p.country && p.country !== name)?.country;
  return country ? `${country} · ${saved}` : saved;
}
