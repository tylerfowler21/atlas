/// MIRRORED FROM ../../src/lib/taxonomy.ts — keep the two identical.
///
/// Categories decide the emoji and colour of every pin, so if the app and the
/// website disagree the same place looks like two different places. Metro
/// cannot reach outside the app directory without monorepo configuration that
/// would complicate cloud builds, so this is a copy, and `npm run check:mirror`
/// in the website fails if they drift.

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
  // Both of these were mid-greys, which read as "disabled" and disappear over
  // pale terrain. Slate and deep ocean stay neutral without vanishing.
  { id: "transport", label: "Transport", icon: "✈️", color: "#4A6B8A" },
  { id: "other", label: "Other", icon: "📍", color: "#0F2D4A" },
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

/// The emoji to show for a saved place: its own if it has one, otherwise its
/// category's. Every list and every map pin goes through here, so a place looks
/// the same everywhere it appears.
export function placeIcon(place: { emoji?: string | null; category: string }) {
  return place.emoji || category(place.category).icon;
}

/// The emoji for one stop on an itinerary, most specific first: the stop's own
/// override, then the place's, then the category. A stop with no place still
/// gets an emoji this way.
export function stopIcon(item: {
  emoji?: string | null;
  category: string;
  kind?: string | null;
  mode?: string | null;
  place?: { emoji?: string | null; category: string } | null;
}) {
  if (item.emoji) return item.emoji;
  // A journey is identified by how you travelled, not by where it started.
  if (item.kind === "travel") return travelMode(item.mode).icon;
  if (item.place) return placeIcon(item.place);
  return category(item.category).icon;
}

/// How you got from one place to the next. Drives the icon, the line drawn on
/// the map, and which directions mode Apple Maps opens in.
export const TRAVEL_MODES = [
  { id: "train", label: "Train", icon: "🚂", dirflg: "r" },
  { id: "bus", label: "Bus", icon: "🚌", dirflg: "r" },
  { id: "plane", label: "Flight", icon: "✈️", dirflg: "d" },
  { id: "ferry", label: "Ferry", icon: "⛴️", dirflg: "r" },
  { id: "car", label: "Car", icon: "🚗", dirflg: "d" },
  { id: "walk", label: "Walk", icon: "🚶", dirflg: "w" },
] as const;

export type TravelModeId = (typeof TRAVEL_MODES)[number]["id"];
export const TRAVEL_MODE_IDS = TRAVEL_MODES.map((m) => m.id) as [
  TravelModeId,
  ...TravelModeId[],
];

const MODE_BY_ID = new Map(TRAVEL_MODES.map((m) => [m.id as string, m]));

export function travelMode(id: string | null | undefined) {
  return MODE_BY_ID.get(id ?? "") ?? MODE_BY_ID.get("train")!;
}

export const STATUSES = [
  { id: "wishlist", label: "Want to go", icon: "🔖" },
  { id: "visited", label: "Been there", icon: "✅" },
  { id: "lived", label: "Lived there", icon: "🏠" },
] as const;

/// Somewhere you have actually been, whether you passed through or stayed.
export const BEEN_STATUSES = ["visited", "lived"] as const;

export type StatusId = (typeof STATUSES)[number]["id"];
export const STATUS_IDS = STATUSES.map((s) => s.id) as [StatusId, ...StatusId[]];

/// Best-effort mapping from an OpenStreetMap class/type onto our categories,
/// so a place added straight from search lands in a sensible bucket.
///
/// Nominatim reports two fields: a broad `class` (amenity, tourism, historic,
/// leisure, shop, natural…) and a specific `type` (restaurant, cathedral,
/// viewpoint…). Type wins when we recognise it, class is the fallback — that
/// way "Sagrada Família" (building/cathedral) lands on Sight rather than Other.
const BY_TYPE: Record<string, CategoryId> = {
  restaurant: "restaurant",
  fast_food: "restaurant",
  food_court: "restaurant",
  deli: "restaurant",
  bakery: "cafe",
  cafe: "cafe",
  coffee: "cafe",
  ice_cream: "cafe",
  tea: "cafe",
  bar: "bar",
  pub: "bar",
  nightclub: "bar",
  biergarten: "bar",
  wine_bar: "bar",
  brewery: "bar",
  hotel: "hotel",
  hostel: "hotel",
  motel: "hotel",
  guest_house: "hotel",
  apartment: "hotel",
  chalet: "hotel",
  camp_site: "hotel",
  museum: "sight",
  gallery: "sight",
  artwork: "sight",
  attraction: "sight",
  monument: "sight",
  memorial: "sight",
  castle: "sight",
  fort: "sight",
  ruins: "sight",
  cathedral: "sight",
  church: "sight",
  chapel: "sight",
  basilica: "sight",
  mosque: "sight",
  synagogue: "sight",
  temple: "sight",
  shrine: "sight",
  place_of_worship: "sight",
  viewpoint: "sight",
  tower: "sight",
  lighthouse: "sight",
  bridge: "sight",
  theatre: "activity",
  cinema: "activity",
  zoo: "activity",
  aquarium: "activity",
  theme_park: "activity",
  water_park: "activity",
  casino: "activity",
  spa: "activity",
  park: "nature",
  garden: "nature",
  nature_reserve: "nature",
  national_park: "nature",
  beach: "nature",
  peak: "nature",
  volcano: "nature",
  waterfall: "nature",
  cliff: "nature",
  bay: "nature",
  island: "nature",
  mall: "shop",
  supermarket: "shop",
  marketplace: "shop",
  department_store: "shop",
  airport: "transport",
  aerodrome: "transport",
  station: "transport",
  bus_station: "transport",
  ferry_terminal: "transport",
  taxi: "transport",
  car_rental: "transport",
};

const BY_CLASS: Record<string, CategoryId> = {
  historic: "sight",
  tourism: "sight",
  natural: "nature",
  leisure: "activity",
  shop: "shop",
  aeroway: "transport",
  railway: "transport",
  public_transport: "transport",
  amenity: "other",
  building: "other",
};

export function guessCategory(osmClass?: string, osmType?: string): CategoryId {
  const type = (osmType ?? "").toLowerCase();
  const klass = (osmClass ?? "").toLowerCase();

  return BY_TYPE[type] ?? BY_CLASS[klass] ?? "other";
}
