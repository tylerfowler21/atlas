/// Where the phone is, and what is around it.
///
/// The website asks the browser; this asks the device, which is the same
/// question with better hardware behind it. Both end at the same endpoint, so
/// the list of what is nearby is worked out in one place.
import { api, type SearchResult } from "@/lib/api";

export type Here =
  | { ok: true; lat: number; lng: number }
  | { ok: false; title: string; detail: string };

export async function currentPosition(): Promise<Here> {
  // Loaded when it is used, not when the screen is imported. It is a native
  // module, so a build made before it was added does not contain it — and a
  // top-level import would throw on startup, taking the whole app down over a
  // button nobody had pressed.
  let Location: typeof import("expo-location");
  try {
    Location = await import("expo-location");
  } catch {
    return {
      ok: false,
      title: "Location needs a newer build",
      detail:
        "Adding the place you're standing in was added after the version installed on this phone. Everything else works; a new build enables it.",
    };
  }

  const permission = await Location.requestForegroundPermissionsAsync();
  if (!permission.granted) {
    return {
      ok: false,
      title: "Location isn't shared",
      detail:
        permission.canAskAgain
          ? "Roava needs your location to find what's around you."
          : "Allow location for Roava in Settings to use this.",
    };
  }

  try {
    const position = await Location.getCurrentPositionAsync({
      // Standing outside a particular restaurant is a question about metres.
      accuracy: Location.Accuracy.High,
    });
    return {
      ok: true,
      lat: position.coords.latitude,
      lng: position.coords.longitude,
    };
  } catch {
    return {
      ok: false,
      title: "Couldn't find you",
      detail: "No fix on your position — this usually means indoors. Try again outside.",
    };
  }
}

export async function nearbyPlaces(lat: number, lng: number): Promise<SearchResult[]> {
  const found = await api<{ results: SearchResult[] }>(
    `/api/nearby?lat=${lat}&lng=${lng}`,
  );
  return found.results ?? [];
}
