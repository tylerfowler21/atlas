import type { SearchResult } from "@/lib/types";

/// Asking the browser where it is, once.
///
/// Wrapped rather than called directly because the failure cases are the
/// interesting part: a refused permission is not an error to retry, an
/// unavailable position usually means indoors or no signal, and a page served
/// over plain http gets no location at all. Each of those wants a different
/// sentence, and the browser's own error codes are numbers.
export type HereError =
  | "unsupported"
  | "denied"
  | "unavailable"
  | "timeout";

export const HERE_MESSAGES: Record<HereError, string> = {
  unsupported: "This browser can't share your location.",
  denied:
    "Location is blocked for this site. You can turn it back on in your browser's site settings.",
  unavailable: "Couldn't get a fix on where you are — try again outdoors.",
  timeout: "That took too long. Try again.",
};

export function currentPosition(): Promise<
  { ok: true; lat: number; lng: number } | { ok: false; error: HereError }
> {
  return new Promise((resolve) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      resolve({ ok: false, error: "unsupported" });
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) =>
        resolve({
          ok: true,
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        }),
      (error) => {
        const code =
          error.code === error.PERMISSION_DENIED
            ? "denied"
            : error.code === error.TIMEOUT
              ? "timeout"
              : "unavailable";
        resolve({ ok: false, error: code });
      },
      {
        // Standing outside a specific restaurant is a question about metres.
        enableHighAccuracy: true,
        timeout: 12_000,
        // A fix from the last half-minute is still where you are standing, and
        // is far quicker than waking the GPS again.
        maximumAge: 30_000,
      },
    );
  });
}

export async function nearbyPlaces(lat: number, lng: number): Promise<SearchResult[]> {
  const res = await fetch(`/api/nearby?lat=${lat}&lng=${lng}`);
  const body = (await res.json()) as { results?: SearchResult[] };
  return body.results ?? [];
}
