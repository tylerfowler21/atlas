import type { SearchResult } from "@/lib/types";

/// One place that knows the shape of a place search, so the four boxes that do
/// it cannot drift apart in what they ask for.
export async function searchPlaces(
  query: string,
  mode: "suggest" | "full",
  region?: string | null,
  /// Where the map is pointing, when the caller has a map. What is inside the
  /// view is searched separately and put first, which is the difference
  /// between "hilton" meaning the resort on the island in front of you and a
  /// village in County Durham.
  around?: { lat: number; lng: number } | null,
): Promise<SearchResult[]> {
  const params = new URLSearchParams({ q: query });
  if (region) params.set("region", region);
  if (around) {
    params.set("lat", String(around.lat));
    params.set("lng", String(around.lng));
  }
  if (mode === "suggest") params.set("suggest", "1");

  const res = await fetch(`/api/geocode?${params}`);
  const body = (await res.json()) as { results?: SearchResult[] };
  return body.results ?? [];
}
