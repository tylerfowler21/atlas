/// Weather for the days of a trip.
///
/// Open-Meteo, which needs no key and has two halves: a forecast that reaches
/// about a fortnight ahead, and an archive for days that have already happened.
/// A trip usually wants one or the other; a trip you are on right now wants
/// both, so the range is split at today and each half asked of the right one.
///
/// Nothing is invented for the gap between. A trip four months out has no
/// forecast, and a plausible-looking number for a day nobody can forecast is
/// worse than an honest blank — you would pack from it.

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
