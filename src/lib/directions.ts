/// Links that hand a destination to Apple Maps.
///
/// Deliberately a hand-off rather than in-app routing: directions are wanted on
/// your phone while you're standing in the street, where the native app has
/// your location, live traffic and turn-by-turn voice. A web map can't compete
/// with that, and doesn't need to.
///
/// maps.apple.com opens the Maps app on Apple devices and the web version
/// elsewhere, so the link is not broken for someone on Android or Windows.

type Point = { lat: number; lng: number; name?: string | null };

const BASE = "https://maps.apple.com/";

function coords(p: Point) {
  return `${p.lat},${p.lng}`;
}

/// Directions to a place, optionally starting from another one — used to route
/// between consecutive stops on a day.
export function directionsUrl(to: Point, from?: Point | null, dirflg?: string) {
  const params = new URLSearchParams();
  params.set("daddr", coords(to));
  if (from) params.set("saddr", coords(from));
  // r = transit, d = drive, w = walk. A train leg should open Apple Maps on
  // its transit tab rather than offering to drive you there.
  if (dirflg) params.set("dirflg", dirflg);
  // Without this Apple sometimes shows a search result rather than the pin.
  if (to.name) params.set("q", to.name);
  return `${BASE}?${params.toString()}`;
}

/// Shows a place on the map without starting a route.
export function showOnAppleMapsUrl(place: Point) {
  const params = new URLSearchParams({ ll: coords(place) });
  if (place.name) params.set("q", place.name);
  return `${BASE}?${params.toString()}`;
}
