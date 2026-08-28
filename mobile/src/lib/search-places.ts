import { api, type SearchResult } from "./api";

/// One place that knows the shape of a place search, matching the website's.
export async function searchPlaces(
  query: string,
  mode: "suggest" | "full",
  region?: string | null,
): Promise<SearchResult[]> {
  const params = new URLSearchParams({ q: query });
  if (region) params.set("region", region);
  if (mode === "suggest") params.set("suggest", "1");

  const found = await api<{ results: SearchResult[] }>(`/api/geocode?${params}`);
  return found.results ?? [];
}
