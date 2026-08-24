export type LngLat = [number, number];

export type Bounds = { west: number; south: number; east: number; north: number };

/// Bounding box around a set of points, with a little padding so pins near the
/// edge aren't flush against the map frame. Returns null for an empty set.
export function boundsOf(points: { lat: number; lng: number }[]): Bounds | null {
  if (points.length === 0) return null;

  let west = 180;
  let south = 90;
  let east = -180;
  let north = -90;

  for (const p of points) {
    west = Math.min(west, p.lng);
    east = Math.max(east, p.lng);
    south = Math.min(south, p.lat);
    north = Math.max(north, p.lat);
  }

  // A single point has a zero-size box, which maplibre can't fit onto.
  const padLng = Math.max((east - west) * 0.15, 0.01);
  const padLat = Math.max((north - south) * 0.15, 0.01);

  return {
    west: west - padLng,
    south: south - padLat,
    east: east + padLng,
    north: north + padLat,
  };
}

const EARTH_RADIUS_KM = 6371;

export function distanceKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(h));
}

/// 🇵🇹 from "pt" — regional indicator symbols are just A–Z offset into a
/// separate Unicode block, so this needs no lookup table.
export function flagEmoji(countryCode?: string | null): string {
  if (!countryCode || countryCode.length !== 2) return "🌍";
  const base = 0x1f1e6;
  const chars = [...countryCode.toUpperCase()].map((c) =>
    String.fromCodePoint(base + c.charCodeAt(0) - 65),
  );
  return chars.join("");
}
