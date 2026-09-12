/// Builds the dotted world map both clients draw on the Been screen.
///
///   npm run build:dot-world
///
/// The map is a grid of dots rather than a drawing: each cell of an
/// equirectangular grid is tested against the world's coastlines once, here,
/// and what ships is a list of the cells that landed on a country. That makes
/// the thing portable — the website draws the grid in SVG and the app draws it
/// in react-native-svg, from the same table, so the two cannot disagree about
/// the shape of the world.
///
/// Natural Earth's 50m map units, which is a particular choice twice over.
///
/// 50m rather than their coarsest 110m sounds like more precision than a
/// five-degree dot can use, and for the outlines it is — but 110m leaves out
/// the microstates entirely, so Singapore and Malta were not countries you
/// could have been to. The extra detail is sampled away; the extra countries
/// are the point.
///
/// Map units rather than countries because a country file folds every
/// overseas territory into its parent. Somebody who has been to Paris and
/// nowhere else then lit a dot in South America, French Guiana being France —
/// true, and unreadable as anything but a bug. Split out, "fr" lights France
/// and Guyane lights only if you have actually been there.
import { writeFileSync } from "node:fs";

const SOURCE =
  "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_50m_admin_0_map_units.geojson";

/// The grid. Wide enough that Britain, Japan and New Zealand survive as
/// something rather than nothing, coarse enough that a phone can draw a dot
/// per cell at a size you can see.
const COLS = 72;
const ROWS = 28;

/// Antarctica is dropped and the far north is trimmed, which is what every
/// map of where somebody has been does. Keeping them would spend a third of
/// the grid's height on two places nobody is counting.
const NORTH = 80;
const SOUTH = -58;

type Ring = [number, number][];
type Feature = {
  properties: Record<string, unknown>;
  geometry: { type: string; coordinates: unknown } | null;
};

/// Ray casting. A point is inside a ring when a line drawn out to the east
/// crosses its edges an odd number of times.
function inRing(lng: number, lat: number, ring: Ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    const straddles = yi > lat !== yj > lat;
    if (straddles && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/// The first ring of a polygon is its outline; any after it are holes, and a
/// point in a hole is not in the country.
function inPolygon(lng: number, lat: number, rings: Ring[]) {
  if (rings.length === 0 || !inRing(lng, lat, rings[0])) return false;
  for (let i = 1; i < rings.length; i++) {
    if (inRing(lng, lat, rings[i])) return false;
  }
  return true;
}

function polygonsOf(feature: Feature): Ring[][] {
  const geometry = feature.geometry;
  if (!geometry) return [];
  if (geometry.type === "Polygon") return [geometry.coordinates as Ring[]];
  if (geometry.type === "MultiPolygon") return geometry.coordinates as Ring[][];
  return [];
}

/// Natural Earth writes "-99" where a place has no code of its own — disputed
/// ground, mostly. Those are drawn as land but belong to nobody, so they can
/// never light up, which is the honest answer.
function codeOf(properties: Record<string, unknown>): string | null {
  for (const key of ["ISO_A2_EH", "ISO_A2"]) {
    const value = properties[key];
    if (typeof value === "string" && value.length === 2 && value !== "-9") {
      return value.toLowerCase();
    }
  }
  return null;
}

/// A cell's bounding box is tested at its middle and at four points inside it.
/// One sample per cell loses small countries whose land happens to miss the
/// exact centre — Denmark, the Netherlands, New Zealand — and the map is
/// mostly read as "have I been there", so missing a country entirely is the
/// worst thing it can do.
const SAMPLES: [number, number][] = [
  [0.5, 0.5],
  [0.25, 0.25],
  [0.75, 0.25],
  [0.25, 0.75],
  [0.75, 0.75],
];

async function main() {
  process.stdout.write(`  fetching ${SOURCE}\n`);
  const response = await fetch(SOURCE);
  if (!response.ok) throw new Error(`Natural Earth returned ${response.status}`);
  const world = (await response.json()) as { features: Feature[] };
  process.stdout.write(`  ${world.features.length} countries\n`);

  const countries = world.features
    .map((f) => ({
      code: codeOf(f.properties),
      name: String(f.properties.NAME ?? f.properties.NAME_EN ?? ""),
      polygons: polygonsOf(f),
    }))
    .filter((c) => c.polygons.length > 0);

  const lngStep = 360 / COLS;
  const latStep = (NORTH - SOUTH) / ROWS;

  /// Which cells each country owns, as `row * COLS + col`.
  const cells = new Map<string, number[]>();
  const land: number[] = [];
  const names: Record<string, string> = {};

  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      const west = -180 + col * lngStep;
      // Row 0 is the top of the picture, which is the northern edge.
      const north = NORTH - row * latStep;
      const cell = row * COLS + col;

      const owners = new Set<string>();
      let isLand = false;
      for (const [fx, fy] of SAMPLES) {
        const lng = west + fx * lngStep;
        const lat = north - fy * latStep;
        for (const country of countries) {
          if (!country.polygons.some((rings) => inPolygon(lng, lat, rings))) continue;
          isLand = true;
          // Land with no country of its own still draws, in the unvisited
          // grey, but can never light.
          if (country.code) {
            owners.add(country.code);
            names[country.code] = country.name;
          }
          break;
        }
      }
      if (!isLand) continue;

      land.push(cell);
      for (const code of owners) {
        const mine = cells.get(code) ?? [];
        mine.push(cell);
        cells.set(code, mine);
      }
    }
  }

  /// Somewhere to light for the countries smaller than a cell.
  ///
  /// A cell here is about five degrees across, which is wider than
  /// Switzerland, the Netherlands or Singapore — so sampling alone gives them
  /// nothing, and going to a resolution that did would be a map of dots too
  /// small to see. Instead each of them borrows the land cell nearest its
  /// middle, which some larger neighbour also owns. The cell then means "you
  /// have been somewhere around here", which is what a dot this size can
  /// honestly say; the count above the map is exact regardless, because it
  /// counts countries rather than dots.
  const cellOf = (lng: number, lat: number) => {
    const col = Math.min(COLS - 1, Math.max(0, Math.floor((lng + 180) / lngStep)));
    const row = Math.min(ROWS - 1, Math.max(0, Math.floor((NORTH - lat) / latStep)));
    return row * COLS + col;
  };

  let borrowed = 0;
  for (const country of countries) {
    if (!country.code || cells.has(country.code)) continue;

    let sumLng = 0;
    let sumLat = 0;
    let n = 0;
    for (const rings of country.polygons) {
      for (const [lng, lat] of rings[0] ?? []) {
        sumLng += lng;
        sumLat += lat;
        n++;
      }
    }
    if (n === 0) continue;

    const home = cellOf(sumLng / n, sumLat / n);
    // The centroid can fall in the sea — a country of islands, or one shaped
    // like a crescent — so the nearest land cell is what it takes.
    const nearest = land.reduce((best, cell) => {
      const d = (c: number) =>
        Math.abs((c % COLS) - (home % COLS)) + Math.abs(Math.floor(c / COLS) - Math.floor(home / COLS));
      return d(cell) < d(best) ? cell : best;
    }, land[0]);

    cells.set(country.code, [nearest]);
    names[country.code] = country.name;
    borrowed++;
  }

  process.stdout.write(
    `  ${land.length} land cells of ${COLS * ROWS}; ${cells.size} countries, ${borrowed} borrowing a neighbour's cell\n`,
  );

  // A picture in the terminal, because the only real test of this is whether
  // it looks like the world.
  const grid = Array.from({ length: ROWS }, () => Array(COLS).fill(" "));
  for (const cell of land) grid[Math.floor(cell / COLS)][cell % COLS] = "#";
  process.stdout.write(grid.map((r) => "  " + r.join("")).join("\n") + "\n");

  const sorted = [...cells.entries()].sort(([a], [b]) => a.localeCompare(b));

  const body = `/// GENERATED by scripts/build-dot-world.ts from Natural Earth 50m map units.
/// Do not edit; run \`npm run build:dot-world\`.
///
/// The world as a grid of dots, for the map of where somebody has been.
///
/// Cells are numbered \`row * DOT_COLS + col\`, with row 0 along the northern
/// edge. Antarctica and the far north are not in the grid at all — every map
/// of where somebody has been leaves them out, and they would otherwise spend
/// a third of its height on two places nobody is counting.
export const DOT_COLS = ${COLS};
export const DOT_ROWS = ${ROWS};

/// Every cell that landed on a country, drawn whether or not you have been.
export const DOT_LAND: readonly number[] = ${JSON.stringify(land)};

/// The cells each country lights. A country too small for a cell of its own
/// borrows the nearest one, which a larger neighbour also owns.
export const DOT_COUNTRY_CELLS: Readonly<Record<string, readonly number[]>> = {
${sorted.map(([code, list]) => `  ${JSON.stringify(code)}: ${JSON.stringify(list)},`).join("\n")}
};

/// What each code is called.
export const DOT_COUNTRY_NAMES: Readonly<Record<string, string>> = ${JSON.stringify(
    Object.fromEntries(Object.entries(names).sort(([a], [b]) => a.localeCompare(b))),
    null,
    2,
  )};
`;

  // Written to both clients rather than mirrored, the way the icons are: a
  // generated file has no source of truth to copy from, only a generator.
  for (const out of ["src/lib/dot-world.ts", "mobile/src/lib/dot-world.ts"]) {
    writeFileSync(out, body);
    process.stdout.write(`  wrote ${out}\n`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
