/// Mirrored from the website's src/lib/trip-styles.ts — edit that copy and run
/// `npm run sync:mirror`.
export const TRIP_STYLES = [
  { id: "first-visit", label: "First visit", asks: "It is their first time there, so the things the place is known for belong in it." },
  { id: "food", label: "Food and drink", asks: "Build it around eating and drinking well, with specific restaurants, markets and bars." },
  { id: "outdoors", label: "Outdoors", asks: "Favour walking, water, parks and viewpoints over indoor attractions." },
  { id: "culture", label: "Culture and history", asks: "Favour museums, galleries, architecture and historic sites." },
  { id: "kids", label: "With kids", asks: "Everything has to work with young children: shorter days, places they can move around, no long sittings." },
  { id: "romantic", label: "Just the two of us", asks: "Quieter and slower, with good dinners and places worth lingering in." },
  { id: "nightlife", label: "Nights out", asks: "Include where to go in the evening — bars, live music, late food." },
] as const;

export type TripStyleId = (typeof TRIP_STYLES)[number]["id"];

export const TRIP_STYLE_IDS = TRIP_STYLES.map((s) => s.id) as [
  TripStyleId,
  ...TripStyleId[],
];

const BY_ID = new Map<string, string>(TRIP_STYLES.map((s) => [s.id, s.asks]));

/// The sentences to hand the model, for the styles somebody picked.
///
/// An id it does not know is dropped rather than refused: a style retired from
/// the list should not turn somebody's saved form into an error.
export function styleAsks(ids: string[]): string[] {
  return ids.map((id) => BY_ID.get(id)).filter((a): a is string => Boolean(a));
}
