/// A place somebody you follow has chosen to show you.
///
/// Narrower than a place of your own by design — no status, no trips, no
/// lived-in dates. What crosses between accounts is what the reading route
/// selects and nothing else, and this type is the written-down version of
/// that: if a field is not here, it does not leave the building.
export type SharedPlace = {
  id: string;
  name: string;
  lat: number;
  lng: number;
  category: string;
  emoji: string | null;
  city: string | null;
  country: string | null;
  notes: string | null;
  rating: number | null;
  photoUrl: string | null;
  user: { name: string | null; username: string | null; image: string | null };
};
