/// Thin server-side wrapper around Nominatim (the OpenStreetMap geocoder).
///
/// This has to live on the server: Nominatim's usage policy requires an
/// identifying User-Agent, which a browser will not let us set, and asks for
/// at most one request per second. We queue requests to honour that and cache
/// results so retyping the same query is free.

const ENDPOINT = "https://nominatim.openstreetmap.org";
const USER_AGENT = "Roava/0.1 (personal travel planner; self-hosted)";
const MIN_INTERVAL_MS = 1100;
const CACHE_TTL_MS = 10 * 60 * 1000;
const CACHE_MAX = 300;

const cache = new Map<string, { at: number; data: unknown }>();
let chain: Promise<unknown> = Promise.resolve();
let lastCallAt = 0;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/// Serialises every outbound call and spaces them out, so concurrent users of
/// this route can never burst past the policy limit.
async function throttled<T>(fn: () => Promise<T>): Promise<T> {
  const run = chain.then(async () => {
    const wait = lastCallAt + MIN_INTERVAL_MS - Date.now();
    if (wait > 0) await sleep(wait);
    lastCallAt = Date.now();
    return fn();
  });
  // Keep the chain alive even if this call rejects.
  chain = run.catch(() => undefined);
  return run;
}

async function call(path: string, params: Record<string, string>) {
  const search = new URLSearchParams({ format: "jsonv2", ...params });
  const key = `${path}?${search}`;

  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.data;

  const data = await throttled(async () => {
    const res = await fetch(`${ENDPOINT}${path}?${search}`, {
      headers: { "User-Agent": USER_AGENT, "Accept-Language": "en" },
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`Nominatim responded ${res.status}`);
    return res.json();
  });

  if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value!);
  cache.set(key, { at: Date.now(), data });
  return data;
}

export type NominatimAddress = {
  house_number?: string;
  road?: string;
  neighbourhood?: string;
  suburb?: string;
  city?: string;
  town?: string;
  village?: string;
  municipality?: string;
  state?: string;
  country?: string;
  country_code?: string;
};

export type NominatimResult = {
  place_id: number;
  lat: string;
  lon: string;
  name?: string;
  display_name: string;
  category?: string;
  type?: string;
  address?: NominatimAddress;
};

export function search(query: string, viewbox?: string) {
  return call("/search", {
    q: query,
    addressdetails: "1",
    limit: "8",
    ...(viewbox ? { viewbox, bounded: "0" } : {}),
  }) as Promise<NominatimResult[]>;
}

export function reverse(lat: number, lon: number) {
  return call("/reverse", {
    lat: String(lat),
    lon: String(lon),
    addressdetails: "1",
    zoom: "18",
  }) as Promise<NominatimResult>;
}

/// Collapses a Nominatim address into the flat shape a Place stores.
export function toPlaceFields(result: NominatimResult) {
  const a = result.address ?? {};
  const city = a.city ?? a.town ?? a.village ?? a.municipality ?? a.suburb ?? null;
  const street = [a.road, a.house_number].filter(Boolean).join(" ");

  return {
    name: result.name?.trim() || result.display_name.split(",")[0]!.trim(),
    lat: Number(result.lat),
    lng: Number(result.lon),
    address: street || result.display_name,
    city,
    country: a.country ?? null,
    countryCode: a.country_code?.toLowerCase() ?? null,
  };
}
