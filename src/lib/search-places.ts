import type { SearchResult } from "@/lib/types";

/// One place that knows the shape of a place search, so the four boxes that do
/// it cannot drift apart in what they ask for.
export async function searchPlaces(
  query: string,
  mode: "suggest" | "full",
  region?: string | null,
): Promise<SearchResult[]> {
  const params = new URLSearchParams({ q: query });
  if (region) params.set("region", region);
  if (mode === "suggest") params.set("suggest", "1");

  const res = await fetch(`/api/geocode?${params}`);
  const body = (await res.json()) as { results?: SearchResult[] };
  return body.results ?? [];
}
