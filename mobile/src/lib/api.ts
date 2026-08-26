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

export type Place = {
  id: string;
  name: string;
  category: string;
  emoji: string | null;
  status: string;
  lat: number;
  lng: number;
  city: string | null;
  country: string | null;
  notes: string | null;
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
