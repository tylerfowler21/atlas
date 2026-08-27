/// A usable name for a place that has not been given one.
///
/// A pin dropped on a city needs no name: it is Zurich, and the person who
/// dropped it knows that. Demanding one anyway turns changing an emoji into
/// filling in a form — so the name falls back to where it is, and only fails
/// when there is nothing at all to fall back to.
///
/// Shared by the website and the app so a nameless pin is called the same
/// thing in both.
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
