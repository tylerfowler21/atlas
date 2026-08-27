/// MIRRORED from ../../../src/lib/place-name.ts. A nameless pin should be
/// called the same thing on a phone as in a browser.

export function placeName(place: {
  name?: string | null;
  city?: string | null;
  country?: string | null;
}) {
  return (
    place.name?.trim() ||
    place.city?.trim() ||
    place.country?.trim() ||
    "Dropped pin"
  );
}
