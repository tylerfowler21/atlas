/// The lookups that have gone wrong before, asked again against the live
/// gazetteers.
///
/// Ranking has broken twice in ways nothing else would catch: once when a
/// stop's name scored nothing against the whole "name, city" string it arrived
/// as, and once when a place could not be told from its twin inside the same
/// province. Both were found by somebody noticing a pin in the wrong country,
/// which is a poor way to find them.
///
/// Every case here is one that was wrong once. Run it after touching anything
/// in geocode.ts: it takes about a minute, mostly waiting on Nominatim's one
/// request a second.
///
///     npx tsx scripts/check-geocoding.ts
import { geocode } from "../src/lib/geocode";

const CANADA = ["Montreal, Canada", "Quebec, Canada"];

const cases: [string, string[] | null, string][] = [
  ["Place Royale, Quebec City", CANADA, "Quebec"],
  ["Place Royale, Montreal", CANADA, "Montreal"],
  ["Schwartz's Deli, Montreal", CANADA, "Montreal"],
  ["Le Continental, Quebec City", CANADA, "Quebec"],
  ["Terrasse Dufferin, Quebec City", CANADA, "Quebec"],
  ["Parc de la Chute-Montmorency, Quebec City", CANADA, "Quebec"],
  ["St-Viateur Bagel, Montreal", CANADA, "Montreal"],
  ["Uffizi Gallery, Florence", ["Florence, Italy"], "Florence"],
  ["Trattoria Mario, Florence", ["Florence, Italy"], "Florence"],
  ["Copenhagen", null, "Copenhagen"],
];

async function main() {
  let bad = 0;
  for (const [query, region, wantCity] of cases) {
    const results = await geocode(query, region);
    const top = results[0];
    const got = top?.city ?? "(none)";
    const ok = got.toLowerCase().includes(wantCity.toLowerCase());
    if (!ok) bad++;
    console.log(
      `${ok ? "ok  " : "FAIL"}  ${query.padEnd(44)} -> ${got.padEnd(12)} ${top ? `${top.lat.toFixed(3)},${top.lng.toFixed(3)}` : ""}${ok ? "" : `  (wanted ${wantCity})`}`,
    );
  }
  console.log(bad === 0 ? "\nall good" : `\n${bad} wrong`);
  if (bad > 0) process.exitCode = 1;
}
void main();
