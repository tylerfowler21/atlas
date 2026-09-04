/// Serialised shapes handed from server components to client components.
/// Dates become ISO strings so the boundary stays boring and JSON-safe.

export type PlaceDTO = {
  id: string;
  name: string;
  category: string;
  emoji: string | null;
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
  livedFrom: string | null;
  livedTo: string | null;
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
  /// ISO timestamp when the owner published it, or null while private.
  publishedAt: string | null;
};

export type ItineraryItemDTO = {
  id: string;
  tripId: string;
  /// "stop" or "travel"
  kind: string;
  placeId: string | null;
  /// Where a travel leg ends
  toPlaceId: string | null;
  mode: string | null;
  title: string;
  emoji: string | null;
  notes: string | null;
  dayIndex: number;
  /// Departure, for a travel leg
  startTime: string | null;
  /// Arrival, for a travel leg
  endTime: string | null;
  category: string;
  position: number;
  /// "needed", "booked", or null for the great majority of stops that are not
  /// bookings at all.
  booking: string | null;
  bookingRef: string | null;
  place: PlaceDTO | null;
  toPlace: PlaceDTO | null;
};

/// Something to have before you go rather than somewhere to be while you are
/// there — an app, a pass, a document, a link.
export type TripResourceDTO = {
  id: string;
  tripId: string;
  label: string;
  url: string | null;
  note: string | null;
  kind: string;
  ready: boolean;
  position: number;
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
  /// Whether this one is where the caller said they were looking — set only
  /// when a region was given. The ranking already puts these first; saying so
  /// lets the trip screens show them on their own and fold the rest away,
  /// which is the difference between "here are five Time Out Markets" and
  /// "here is the one in Lisbon".
  nearby?: boolean;
};

type DateLike = { toISOString(): string };

export function serializePlace<
  T extends {
    visitedAt: DateLike | null;
    livedFrom?: DateLike | null;
    livedTo?: DateLike | null;
    createdAt: DateLike;
  },
>(p: T): PlaceDTO {
  return {
    ...(p as unknown as PlaceDTO),
    visitedAt: p.visitedAt ? p.visitedAt.toISOString() : null,
    livedFrom: p.livedFrom ? p.livedFrom.toISOString() : null,
    livedTo: p.livedTo ? p.livedTo.toISOString() : null,
    createdAt: p.createdAt.toISOString(),
  };
}

export function serializeTrip<
  T extends {
    startDate: DateLike | null;
    endDate: DateLike | null;
    publishedAt?: DateLike | null;
  },
>(t: T): TripDTO {
  return {
    ...(t as unknown as TripDTO),
    startDate: t.startDate ? t.startDate.toISOString() : null,
    endDate: t.endDate ? t.endDate.toISOString() : null,
    publishedAt: t.publishedAt ? t.publishedAt.toISOString() : null,
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
  emoji: string | null;
  lat: number;
  lng: number;
  city: string | null;
  country: string | null;
  countryCode: string | null;
};

export type PublicItemDTO = {
  id: string;
  kind: string;
  mode: string | null;
  title: string;
  emoji: string | null;
  notes: string | null;
  dayIndex: number;
  startTime: string | null;
  endTime: string | null;
  category: string;
  position: number;
  place: PublicPlaceDTO | null;
  toPlace: PublicPlaceDTO | null;
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
  emoji: string | null;
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
    emoji: p.emoji,
    lat: p.lat,
    lng: p.lng,
    city: p.city,
    country: p.country,
    countryCode: p.countryCode,
  };
}


export type MemoryDTO = {
  id: string;
  title: string | null;
  body: string;
  happenedOn: string | null;
  createdAt: string;
  placeId: string | null;
  tripId: string | null;
  place: { id: string; name: string; city: string | null; country: string | null } | null;
  trip: { id: string; title: string } | null;
  photos: { id: string }[];
};
