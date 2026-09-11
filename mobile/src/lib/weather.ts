/// Mirrored from the website's src/lib/weather.ts — edit that copy and run
/// `npm run sync-mirror`. Both clients should call the same sky the same
/// thing.
/// WMO weather codes, which is what both endpoints speak.
const CONDITIONS: [number[], string, string][] = [
  [[0], "☀️", "Clear"],
  [[1], "🌤️", "Mostly clear"],
  [[2], "⛅️", "Partly cloudy"],
  [[3], "☁️", "Overcast"],
  [[45, 48], "🌫️", "Fog"],
  [[51, 53, 55, 56, 57], "🌦️", "Drizzle"],
  [[61, 63, 65, 66, 67], "🌧️", "Rain"],
  [[71, 73, 75, 77], "🌨️", "Snow"],
  [[80, 81, 82], "🌦️", "Showers"],
  [[85, 86], "🌨️", "Snow showers"],
  [[95, 96, 99], "⛈️", "Thunderstorms"],
];

export function condition(code: number): { icon: string; label: string } {
  for (const [codes, icon, label] of CONDITIONS) {
    if (codes.includes(code)) return { icon, label };
  }
  return { icon: "🌡️", label: "Unsettled" };
}

export type DayWeather = {
  /// "2026-09-18"
  date: string;
  code: number;
  high: number;
  low: number;
  /// Chance of rain, 0–100. Null for archived days, which record what fell
  /// rather than what might.
  rain: number | null;
  /// Whether this is a forecast or what actually happened.
  kind: "forecast" | "recorded";
};

/// Fahrenheit for the handful of places that use it, Celsius everywhere else.
/// Taken from the locale rather than asked for: nobody wants a settings screen
/// to find out how warm Lisbon is.
export function unitsFor(locale: string): "fahrenheit" | "celsius" {
  const region = locale.split("-")[1]?.toUpperCase();
  return region && ["US", "LR", "MM", "BS", "KY", "PW", "FM", "MH"].includes(region)
    ? "fahrenheit"
    : "celsius";
}

/// How far ahead the forecast is worth asking for. Beyond this Open-Meteo will
/// still answer, but it is extrapolating climate rather than forecasting.
export const FORECAST_DAYS = 16;

/// One stretch of a trip spent in roughly one place.
export type WeatherSegment = {
  lat: number;
  lng: number;
  /// Inclusive, "2026-09-18".
  start: string;
  end: string;
};

const DAY_MS = 86_400_000;

/// Splits a trip into the places it actually passes through.
///
/// Asking once for the whole trip and using the first stop's coordinates is
/// right for a long weekend and wrong for a fortnight: a trip through Lucerne,
/// Interlaken and Zermatt would show Lucerne's weather in all three, which is
/// worse than showing none — a wrong number is packed from.
///
/// A day with no placed stop inherits the day before it. You are somewhere
/// between plans, and the last place you were is a far better guess than the
/// start of the trip.
///
/// Consecutive days in the same place become one segment, so a city you stay
/// in for four days is one request rather than four.
export function weatherSegments(
  startDate: string,
  days: number,
  items: { dayIndex: number; place: { lat: number; lng: number } | null }[],
): WeatherSegment[] {
  const start = Date.parse(startDate);
  if (Number.isNaN(start) || days < 1) return [];

  const firstOnDay = new Map<number, { lat: number; lng: number }>();
  for (const item of items) {
    if (!item.place || firstOnDay.has(item.dayIndex)) continue;
    firstOnDay.set(item.dayIndex, { lat: item.place.lat, lng: item.place.lng });
  }
  if (firstOnDay.size === 0) return [];

  // Before the first placed day there is nothing to inherit, so those days
  // borrow forwards from the first place the trip knows about.
  const earliest = Math.min(...firstOnDay.keys());
  const opening = firstOnDay.get(earliest)!;

  const segments: WeatherSegment[] = [];
  let carried = opening;

  for (let day = 0; day < days; day += 1) {
    carried = firstOnDay.get(day) ?? carried;
    const date = new Date(start + day * DAY_MS).toISOString().slice(0, 10);
    const last = segments[segments.length - 1];

    // Two decimal places is about a kilometre — far finer than weather varies,
    // and coarse enough that two stops in the same city stay one request.
    const sameAsLast =
      last &&
      last.lat.toFixed(2) === carried.lat.toFixed(2) &&
      last.lng.toFixed(2) === carried.lng.toFixed(2);

    if (sameAsLast) last.end = date;
    else segments.push({ lat: carried.lat, lng: carried.lng, start: date, end: date });
  }

  return segments;
}
