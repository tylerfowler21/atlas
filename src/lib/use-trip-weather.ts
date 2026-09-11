"use client";

import { useEffect, useState } from "react";
import { unitsFor, type DayWeather, type WeatherSegment } from "@/lib/weather";

const NONE: Map<string, DayWeather> = new Map();

/// Weather for a trip, one request per place it passes through.
///
/// Segments rather than a single point: a fortnight through three cities is
/// three questions, and asking only the first would answer all three with
/// Lucerne. A trip that stays put is still one request, which is the common
/// case and stays cheap.
export function useTripWeather(segments: WeatherSegment[]): Map<string, DayWeather> {
  /// The answer carries the question it answers, so a trip that changes shows
  /// nothing rather than the last one's weather — and without a setState in
  /// the effect's synchronous path, which the compiler refuses.
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

    const units = unitsFor(
      typeof navigator === "undefined" ? "en-US" : (navigator.language ?? "en-US"),
    );

    // In parallel: they are separate places, and a trip should not wait three
    // round trips to show the first day.
    void Promise.all(
      key.split("|").map(async (part) => {
        const [lat, lng, start, end] = part.split(",");
        const params = new URLSearchParams({ lat: lat!, lng: lng!, start: start!, end: end!, units });
        try {
          const res = await fetch(`/api/weather?${params}`);
          const body = (await res.json()) as { days?: DayWeather[] };
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
