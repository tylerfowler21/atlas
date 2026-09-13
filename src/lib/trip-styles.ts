/// What kind of trip somebody is asking for.
///
/// Separate from "what you're into", which is free text for the specifics —
/// "seafood, not too many museums". These are the handful of answers that
/// change the shape of an itinerary rather than its details: a trip with a
/// four-year-old and a trip built around dinner are different plans of the
/// same city, and a model told neither writes the average of both.
///
/// Shared so the form and the thing that validates it cannot drift.
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
