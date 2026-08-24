/// Serialised shapes handed from server components to client components.
/// Dates become ISO strings so the boundary stays boring and JSON-safe.

export type PlaceDTO = {
  id: string;
  name: string;
  category: string;
  status: string;
  lat: number;
  lng: number;
  address: string | null;
  city: string | null;
  country: string | null;
  countryCode: string | null;
  notes: string | null;
  rating: number | null;
  website: string | null;
  visitedAt: string | null;
  createdAt: string;
};

export type TripDTO = {
  id: string;
  title: string;
  destination: string | null;
  startDate: string | null;
  endDate: string | null;
  notes: string | null;
  color: string;
};

export type ItineraryItemDTO = {
  id: string;
  tripId: string;
  placeId: string | null;
  title: string;
  notes: string | null;
  dayIndex: number;
  startTime: string | null;
  category: string;
  position: number;
  place: PlaceDTO | null;
};

/// A place as returned by the geocode proxy, before it is saved.
export type SearchResult = {
  id: string;
  name: string;
  lat: number;
  lng: number;
  address: string | null;
  city: string | null;
  country: string | null;
  countryCode: string | null;
  category: string;
  context: string;
};

type DateLike = { toISOString(): string };

export function serializePlace<T extends { visitedAt: DateLike | null; createdAt: DateLike }>(
  p: T,
): PlaceDTO {
  return {
    ...(p as unknown as PlaceDTO),
    visitedAt: p.visitedAt ? p.visitedAt.toISOString() : null,
    createdAt: p.createdAt.toISOString(),
  };
}

export function serializeTrip<T extends { startDate: DateLike | null; endDate: DateLike | null }>(
  t: T,
): TripDTO {
  return {
    ...(t as unknown as TripDTO),
    startDate: t.startDate ? t.startDate.toISOString() : null,
    endDate: t.endDate ? t.endDate.toISOString() : null,
  };
}

/// A place that has been located but not yet saved — either picked from search
/// or dropped as a pin on the map.
export type PlaceDraft = {
  name: string;
  lat: number;
  lng: number;
  address: string | null;
  city: string | null;
  country: string | null;
  countryCode: string | null;
  category: string;
};

// --- public (shared-link) shapes -----------------------------------------
//
// A shared itinerary is readable by anyone holding the link, so these types
// are an explicit allow-list rather than a copy of the private DTOs. Notably
// absent: a place's personal notes and rating, which belong to the owner's
// library rather than to the trip they were used in.

export type PublicPlaceDTO = {
  id: string;
  name: string;
  category: string;
  lat: number;
  lng: number;
  city: string | null;
  country: string | null;
  countryCode: string | null;
};

export type PublicItemDTO = {
  id: string;
  title: string;
  notes: string | null;
  dayIndex: number;
  startTime: string | null;
  category: string;
  position: number;
  place: PublicPlaceDTO | null;
};

export type PublicTripDTO = {
  title: string;
  destination: string | null;
  startDate: string | null;
  endDate: string | null;
  color: string;
};

export function toPublicPlace(p: {
  id: string;
  name: string;
  category: string;
  lat: number;
  lng: number;
  city: string | null;
  country: string | null;
  countryCode: string | null;
}): PublicPlaceDTO {
  return {
    id: p.id,
    name: p.name,
    category: p.category,
    lat: p.lat,
    lng: p.lng,
    city: p.city,
    country: p.country,
    countryCode: p.countryCode,
  };
}
