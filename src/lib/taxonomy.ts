/// The single source of truth for place categories. Everything that needs a
/// colour, an icon, or a label for a category reads it from here so the map,
/// the lists, and the itinerary can never drift apart.

export const CATEGORIES = [
  { id: "restaurant", label: "Restaurant", icon: "🍽️", color: "#ef4444" },
  { id: "cafe", label: "Café", icon: "☕", color: "#b45309" },
  { id: "bar", label: "Bar", icon: "🍸", color: "#a855f7" },
  { id: "activity", label: "Activity", icon: "🎟️", color: "#f59e0b" },
  { id: "sight", label: "Sight", icon: "🏛️", color: "#0ea5e9" },
  { id: "nature", label: "Nature", icon: "🏞️", color: "#10b981" },
  { id: "hotel", label: "Stay", icon: "🛏️", color: "#6366f1" },
  { id: "shop", label: "Shop", icon: "🛍️", color: "#ec4899" },
  { id: "transport", label: "Transport", icon: "✈️", color: "#64748b" },
  { id: "other", label: "Other", icon: "📍", color: "#737373" },
] as const;

export type CategoryId = (typeof CATEGORIES)[number]["id"];

export const CATEGORY_IDS = CATEGORIES.map((c) => c.id) as [
  CategoryId,
  ...CategoryId[],
];

const BY_ID = new Map(CATEGORIES.map((c) => [c.id as string, c]));

export function category(id: string) {
  return BY_ID.get(id) ?? BY_ID.get("other")!;
}

export const STATUSES = [
  { id: "wishlist", label: "Want to go", icon: "🔖" },
  { id: "visited", label: "Been there", icon: "✅" },
] as const;

export type StatusId = (typeof STATUSES)[number]["id"];
export const STATUS_IDS = STATUSES.map((s) => s.id) as [StatusId, ...StatusId[]];

/// Best-effort mapping from an OpenStreetMap category/type onto ours, so a
/// place added straight from search lands in a sensible bucket.
export function guessCategory(osmClass?: string, osmType?: string): CategoryId {
  const t = (osmType ?? "").toLowerCase();
  const c = (osmClass ?? "").toLowerCase();

  if (t === "restaurant" || t === "fast_food" || t === "food_court") return "restaurant";
  if (t === "cafe" || t === "coffee" || t === "ice_cream") return "cafe";
  if (t === "bar" || t === "pub" || t === "nightclub" || t === "biergarten") return "bar";
  if (t === "hotel" || t === "hostel" || t === "guest_house" || t === "motel" || c === "tourism" && t === "apartment") return "hotel";
  if (t === "museum" || t === "attraction" || t === "artwork" || t === "monument" || t === "memorial" || t === "castle") return "sight";
  if (c === "historic") return "sight";
  if (t === "theatre" || t === "cinema" || t === "zoo" || t === "theme_park" || t === "aquarium") return "activity";
  if (c === "leisure") return "activity";
  if (c === "natural" || t === "park" || t === "beach" || t === "peak" || t === "national_park") return "nature";
  if (c === "shop" || t === "mall" || t === "supermarket") return "shop";
  if (c === "aeroway" || t === "airport" || t === "station" || t === "bus_station" || t === "ferry_terminal") return "transport";
  return "other";
}
