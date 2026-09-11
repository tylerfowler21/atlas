/// Weather for a trip, one request per place it passes through.
///
/// Segments rather than a single point: a fortnight through three cities is
/// three questions, and asking only the first would answer all three with
/// Lucerne. A trip that stays put is still one request.
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { unitsFor, type DayWeather, type WeatherSegment } from "@/lib/weather";

const NONE: Map<string, DayWeather> = new Map();

function deviceLocale() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().locale ?? "en-US";
  } catch {
    return "en-US";
  }
}

export function useTripWeather(segments: WeatherSegment[]): Map<string, DayWeather> {
  /// The answer carries the question it answers, so a trip that changes shows
  /// nothing rather than the last one's weather.
  const [state, setState] = useState<{ key: string; days: Map<string, DayWeather> }>({
    key: "",
    days: NONE,
  });

  const key = segments
    .map((s) => `${s.lat.toFixed(2)},${s.lng.toFixed(2)},${s.start},${s.end}`)
    .join("|");

  useEffect(() => {
    if (!key) return;
    let alive = true;
    const units = unitsFor(deviceLocale());

    void Promise.all(
      key.split("|").map(async (part) => {
        const [lat, lng, start, end] = part.split(",");
        const params = new URLSearchParams({ lat: lat!, lng: lng!, start: start!, end: end!, units });
        try {
          const body = await api<{ days: DayWeather[] }>(`/api/weather?${params}`);
          return body.days ?? [];
        } catch {
          // A trip is perfectly usable without weather on it.
          return [];
        }
      }),
    ).then((all) => {
      if (!alive) return;
      setState({ key, days: new Map(all.flat().map((d) => [d.date, d])) });
    });

    return () => {
      alive = false;
    };
  }, [key]);

  return state.key === key ? state.days : NONE;
}
