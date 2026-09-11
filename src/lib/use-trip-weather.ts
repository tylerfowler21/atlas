"use client";

import { useEffect, useState } from "react";
import { unitsFor, type DayWeather } from "@/lib/weather";

const NONE: Map<string, DayWeather> = new Map();

/// Weather for a whole trip, asked for once.
///
/// Keyed on the place and the range rather than fetched per day: one request
/// covers a fortnight, and asking per day would be fourteen requests for the
/// same answer.
export function useTripWeather(
  centre: { lat: number; lng: number } | null,
  start: string | null,
  end: string | null,
): Map<string, DayWeather> {
  /// The answer carries the question it answers. Clearing state when the trip
  /// changes would mean a setState in the effect's synchronous path, which the
  /// compiler refuses — and rightly, since the same thing falls out of
  /// comparing keys, without the extra render.
  const [state, setState] = useState<{ key: string; days: Map<string, DayWeather> }>({
    key: "",
    days: NONE,
  });

  const lat = centre?.lat ?? null;
  const lng = centre?.lng ?? null;
  const key =
    lat !== null && lng !== null && start && end ? `${lat},${lng},${start},${end}` : "";

  useEffect(() => {
    if (!key) return;

    let alive = true;
    const [kLat, kLng, kStart, kEnd] = key.split(",");
    const params = new URLSearchParams({
      lat: kLat!,
      lng: kLng!,
      start: kStart!,
      end: kEnd!,
      units: unitsFor(
        typeof navigator === "undefined" ? "en-US" : (navigator.language ?? "en-US"),
      ),
    });

    void fetch(`/api/weather?${params}`)
      .then((r) => r.json())
      .then((body: { days?: DayWeather[] }) => {
        if (!alive) return;
        setState({ key, days: new Map((body.days ?? []).map((d) => [d.date, d])) });
      })
      // A trip is perfectly usable without weather on it.
      .catch(() => {});

    return () => {
      alive = false;
    };
  }, [key]);

  return state.key === key ? state.days : NONE;
}
