/// The app talks to exactly the same API the website does, with a bearer token
/// where the browser would send a cookie.
import * as SecureStore from "expo-secure-store";

const TOKEN_KEY = "roava.token";

/// Set per build. There is no sensible default: pointing a debug build at
/// production by accident is how test data ends up in real accounts.
export const API_URL = process.env.EXPO_PUBLIC_API_URL ?? "";

export async function storedToken() {
  return SecureStore.getItemAsync(TOKEN_KEY);
}
export async function storeToken(token: string) {
  await SecureStore.setItemAsync(TOKEN_KEY, token);
}
export async function clearToken() {
  await SecureStore.deleteItemAsync(TOKEN_KEY);
}

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
  /// Worth distinguishing: the token expired or the account was deleted, and
  /// the only useful response is to sign the person out.
  get isSignedOut() {
    return this.status === 401;
  }
}

export async function api<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  if (!API_URL) {
    throw new ApiError(0, "EXPO_PUBLIC_API_URL is not set for this build");
  }
  const token = await storedToken();
  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init.headers,
    },
  });

  if (!response.ok) {
    // The API answers errors as JSON, but a proxy or a cold start can return
    // HTML, and parsing that as JSON would report the wrong problem entirely.
    let message = `Request failed (${response.status})`;
    try {
      const body = await response.json();
      if (typeof body?.error === "string") message = body.error;
    } catch {}
    throw new ApiError(response.status, message);
  }

  return response.json() as Promise<T>;
}

/// Uploads a file. Kept apart from `api` because the body is multipart and the
/// Content-Type header must be set by the runtime, not by us — it carries a
/// boundary marker that has to match the body exactly.
export async function upload<T>(path: string, form: FormData): Promise<T> {
  if (!API_URL) throw new ApiError(0, "EXPO_PUBLIC_API_URL is not set for this build");
  const token = await storedToken();
  const response = await fetch(`${API_URL}${path}`, {
    method: "POST",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: form,
  });
  if (!response.ok) {
    let message = `Upload failed (${response.status})`;
    try {
      const body = await response.json();
      if (typeof body?.error === "string") message = body.error;
    } catch {}
    throw new ApiError(response.status, message);
  }
  return response.json() as Promise<T>;
}

export type Place = {
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
  /// Only meaningful for "lived": when you moved there, and when you left.
  livedFrom: string | null;
  livedTo: string | null;
};

/// A place found by the geocoder, before anyone saves it.
export type SearchResult = {
  /// Whether this one is where the caller said they were looking — set only
  /// when a region was given, so a trip screen can show these on their own.
  nearby?: boolean;
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

export type Memory = {
  id: string;
  title: string | null;
  body: string;
  happenedOn: string | null;
  createdAt: string;
  place: { id: string; name: string; city: string | null } | null;
  trip: { id: string; title: string } | null;
  photos: { id: string }[];
};

export type FeedTrip = {
  id: string;
  title: string;
  destination: string | null;
  startDate: string | null;
  endDate: string | null;
  color: string;
  publishedAt: string;
  stopCount: number;
  author: { username: string | null; name: string | null; image: string | null };
};

export type Notification = {
  id: string;
  kind: string;
  tripTitle: string | null;
  tripId: string | null;
  readAt: string | null;
  createdAt: string;
  actor: { name: string | null; username: string | null; image: string | null } | null;
};

export type Me = {
  id: string;
  name: string | null;
  username: string | null;
  image: string | null;
  onboarded: boolean;
};

export type Person = {
  id: string;
  name: string | null;
  username: string | null;
  image: string | null;
  bio: string | null;
  followers: number;
  publishedTrips: number;
  following: boolean;
};

export type ItineraryItem = {
  id: string;
  tripId: string;
  /// "stop" or "travel"
  kind: string;
  placeId: string | null;
  toPlaceId: string | null;
  mode: string | null;
  title: string;
  emoji: string | null;
  notes: string | null;
  dayIndex: number;
  startTime: string | null;
  endTime: string | null;
  category: string;
  position: number;
  /// Carries emoji and category because the icon for a stop resolves through
  /// them — the stop's own override, then the place's, then the category's.
  /// Without those a saved place would show a different icon on the phone than
  /// on the map it came from.
  place: ItemPlace | null;
  toPlace: ItemPlace | null;
};

type ItemPlace = {
  id: string;
  name: string;
  city: string | null;
  emoji: string | null;
  category: string;
  lat: number;
  lng: number;
};

export type Trip = {
  id: string;
  title: string;
  destination: string | null;
  startDate: string | null;
  endDate: string | null;
  color: string;
  publishedAt: string | null;
};
