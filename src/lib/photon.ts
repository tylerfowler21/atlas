/// Photon (photon.komoot.io) — an OpenStreetMap geocoder built for
/// type-ahead. It tolerates misspellings that Nominatim refuses outright:
/// "Grindlewald" finds Grindelwald, "Lucern" finds Lucerne.
///
/// It is used alongside Nominatim rather than instead of it. Photon is the
/// forgiving one; Nominatim is the precise one, and it is better at full
/// addresses. Between them they cover more than either does alone.

import { guessCategory } from "@/lib/taxonomy";
import type { SearchResult } from "@/lib/types";

const ENDPOINT = "https://photon.komoot.io/api/";
const USER_AGENT = "Roava/0.1 (personal travel planner; self-hosted)";

type PhotonFeature = {
  geometry: { coordinates: [number, number] };
  properties: {
    name?: string;
    street?: string;
    housenumber?: string;
    city?: string;
    district?: string;
    state?: string;
    country?: string;
    countrycode?: string;
    osm_key?: string;
    osm_value?: string;
  };
};

export async function photonSearch(query: string): Promise<SearchResult[]> {
  const params = new URLSearchParams({ q: query, limit: "8", lang: "en" });

  const res = await fetch(`${ENDPOINT}?${params}`, {
    headers: { "User-Agent": USER_AGENT },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Photon responded ${res.status}`);

  const body = (await res.json()) as { features?: PhotonFeature[] };

  return (body.features ?? [])
    .filter((f) => f.properties.name && f.geometry?.coordinates)
    .map((f, index) => {
      const p = f.properties;
      const [lng, lat] = f.geometry.coordinates;
      const street = [p.street, p.housenumber].filter(Boolean).join(" ");

      return {
        id: `photon-${index}-${lat.toFixed(5)},${lng.toFixed(5)}`,
        name: p.name!,
        lat,
        lng,
        address: street || null,
        city: p.city ?? p.district ?? null,
        country: p.country ?? null,
        countryCode: p.countrycode?.toLowerCase() ?? null,
        category: guessCategory(p.osm_key, p.osm_value),
        context: [p.name, p.city ?? p.district, p.state, p.country]
          .filter(Boolean)
          .join(", "),
      };
    });
}
