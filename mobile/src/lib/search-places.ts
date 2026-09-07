import { api, type SearchResult } from "./api";

/// One place that knows the shape of a place search, matching the website's.
export async function searchPlaces(
  query: string,
  mode: "suggest" | "full",
  region?: string | null,
  /// Where the map is pointing. What is inside the view is searched separately
  /// and put first, which is the difference between "hilton" meaning the
  /// resort on the island in front of you and a village in County Durham.
  around?: { lat: number; lng: number } | null,
): Promise<SearchResult[]> {
  const params = new URLSearchParams({ q: query });
  if (region) params.set("region", region);
  if (around) {
    params.set("lat", String(around.lat));
    params.set("lng", String(around.lng));
  }
  if (mode === "suggest") params.set("suggest", "1");

  const found = await api<{ results: SearchResult[] }>(`/api/geocode?${params}`);
  return found.results ?? [];
}
