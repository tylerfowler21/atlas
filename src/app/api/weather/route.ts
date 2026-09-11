import { NextResponse } from "next/server";
import { unauthorized } from "@/lib/api";
import { getCurrentUser } from "@/lib/user";
import { FORECAST_DAYS, type DayWeather } from "@/lib/weather";

const FORECAST = "https://api.open-meteo.com/v1/forecast";
const ARCHIVE = "https://archive-api.open-meteo.com/v1/archive";

const DAY_MS = 86_400_000;

/// A short cache, keyed by everything that changes the answer. A trip screen
/// asks on every open and the forecast changes hourly at best, so this spares
/// both Open-Meteo and the person waiting.
const cache = new Map<string, { at: number; data: DayWeather[] }>();
const CACHE_TTL_MS = 30 * 60 * 1000;
const CACHE_MAX = 200;

function isoDay(time: number) {
  return new Date(time).toISOString().slice(0, 10);
}

async function ask(
  endpoint: string,
  params: URLSearchParams,
  kind: DayWeather["kind"],
): Promise<DayWeather[]> {
  const res = await fetch(`${endpoint}?${params}`, { cache: "no-store" });
  if (!res.ok) throw new Error(`Open-Meteo responded ${res.status}`);
  const body = (await res.json()) as {
    daily?: {
      time?: string[];
      weather_code?: number[];
      temperature_2m_max?: (number | null)[];
      temperature_2m_min?: (number | null)[];
      precipitation_probability_max?: (number | null)[];
    };
  };

  const daily = body.daily;
  if (!daily?.time) return [];

  return daily.time.flatMap((date, i) => {
    const high = daily.temperature_2m_max?.[i];
    const low = daily.temperature_2m_min?.[i];
    // A day the archive has not caught up with comes back as nulls rather than
    // as an absence, and an empty row is worse than no row.
    if (high == null || low == null) return [];
    return [
      {
        date,
        code: daily.weather_code?.[i] ?? 0,
        high: Math.round(high),
        low: Math.round(low),
        rain: daily.precipitation_probability_max?.[i] ?? null,
        kind,
      },
    ];
  });
}

/// Weather for a place across a range of days.
///
/// Signed in only — this is a trip feature, and an open proxy to somebody
/// else's API is a thing other people find.
export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return unauthorized();

  const { searchParams } = new URL(request.url);
  const lat = Number(searchParams.get("lat"));
  const lng = Number(searchParams.get("lng"));
  const start = searchParams.get("start") ?? "";
  const end = searchParams.get("end") ?? start;
  const units = searchParams.get("units") === "fahrenheit" ? "fahrenheit" : "celsius";

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return NextResponse.json({ error: "Where?" }, { status: 400 });
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(start) || !/^\d{4}-\d{2}-\d{2}$/.test(end)) {
    return NextResponse.json({ error: "When?" }, { status: 400 });
  }

  // Rounded, because weather does not change across a few hundred metres and
  // every stop on a day would otherwise be its own cache entry.
  const key = `${lat.toFixed(2)},${lng.toFixed(2)},${start},${end},${units}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) {
    return NextResponse.json({ days: hit.data });
  }

  const today = isoDay(Date.now());
  const common = {
    latitude: String(lat),
    longitude: String(lng),
    daily: "weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max",
    timezone: "auto",
    temperature_unit: units,
  };

  try {
    const days: DayWeather[] = [];

    // The past half, if any. The archive lags a few days behind today, which
    // is why a trip happening right now can have a gap in the middle.
    if (start < today) {
      const pastEnd = end < today ? end : isoDay(Date.now() - DAY_MS);
      days.push(
        ...(await ask(
          ARCHIVE,
          new URLSearchParams({ ...common, start_date: start, end_date: pastEnd }),
          "recorded",
        )),
      );
    }

    // And the forecast half, for anything from today on that is close enough
    // to be a forecast rather than a guess.
    if (end >= today) {
      const horizon = isoDay(Date.now() + FORECAST_DAYS * DAY_MS);
      const from = start > today ? start : today;
      const to = end < horizon ? end : horizon;
      if (from <= to) {
        days.push(
          ...(await ask(
            FORECAST,
            new URLSearchParams({ ...common, start_date: from, end_date: to }),
            "forecast",
          )),
        );
      }
    }

    if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value!);
    cache.set(key, { at: Date.now(), data: days });

    return NextResponse.json({ days });
  } catch {
    // A trip is perfectly usable without weather on it.
    return NextResponse.json({ days: [] });
  }
}
