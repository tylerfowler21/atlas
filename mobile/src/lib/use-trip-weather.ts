/// Weather for a whole trip, asked for once.
///
/// Keyed on the place and the range rather than fetched per day: one request
/// covers a fortnight, and asking per day would be fourteen requests for the
/// same answer.
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { unitsFor, type DayWeather } from "@/lib/weather";

const NONE: Map<string, DayWeather> = new Map();

function deviceLocale() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().locale ?? "en-US";
  } catch {
    return "en-US";
  }
}

export function useTripWeather(
  centre: { lat: number; lng: number } | null,
  start: string | null,
  end: string | null,
): Map<string, DayWeather> {
  /// The answer carries the question it answers, so a trip that changes shows
  /// nothing rather than the last trip's weather — and without a setState in
  /// the effect's synchronous path.
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
      units: unitsFor(deviceLocale()),
    });

    void api<{ days: DayWeather[] }>(`/api/weather?${params}`)
      .then((body) => {
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
