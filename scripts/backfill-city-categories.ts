/// Re-files the places that are cities but were saved as Other.
///
/// In OpenStreetMap a large city is usually the administrative relation around
/// the place rather than a `place=city` point, so Florence, Kyoto, Porto and
/// the rest arrived tagged boundary / administrative — which is also what a
/// country is, and so landed on Other. The gazetteer's own `addresstype` now
/// decides it, but everything saved before that keeps the category it was
/// given.
///
/// Each candidate is looked up again and only re-filed when the gazetteer
/// answers with a settlement near the coordinates already stored — so the
/// Florence in Tuscany is not re-filed from the one in Alabama.
///
/// Nominatim is asked directly rather than through `geocode`, which merges in
/// a second gazetteer that does not carry `addresstype` and would disagree
/// about exactly the places this is here to fix.
///
/// Prints what it would do and changes nothing. Pass --write to apply it.
import { prisma } from "../src/lib/db-script";
import { search } from "../src/lib/nominatim";
import { guessCategory } from "../src/lib/taxonomy";

const write = process.argv.includes("--write");

/// Close enough to be the same place — about fifty kilometres.
///
/// Generous on purpose. What is stored is wherever the gazetteer put the thing
/// when it was saved, which for a big city can be the centre of a boundary it
/// no longer offers: the saved Mexico City sits on the Federal District's
/// centre, twelve kilometres from the city's. The namesakes this is guarding
/// against — Florence in Alabama, Malmö in Nebraska — are thousands of
/// kilometres away, not fifty.
const SAME_PLACE_DEGREES = 0.5;

/// Places the gazetteer answers correctly and we still do not want re-filed.
///
/// Trümmelbach is the waterfall in the Lauterbrunnen valley, and there is a
/// hamlet of the same name beside it — so the lookup returns a settlement at
/// the right coordinates and every test here passes. The stored place is the
/// falls. A list of names is a blunt instrument, but the alternative is asking
/// this script to know what a person meant when they saved something, which it
/// cannot, and the blunt instrument is two lines long.
const LEAVE_ALONE = new Set(["trümmelbach", "trummelbach"]);

async function main() {
  const places = await prisma.place.findMany({
    where: { category: "other" },
    select: { id: true, name: true, city: true, country: true, lat: true, lng: true },
    orderBy: { name: "asc" },
  });

  console.log(`${places.length} place(s) filed as Other\n`);

  const changing: { id: string; name: string; where: string }[] = [];

  for (const place of places) {
    if (LEAVE_ALONE.has(place.name.trim().toLowerCase())) {
      console.log(`  ·  ${place.name} — left alone on purpose`);
      continue;
    }

    const query = place.country ? `${place.name}, ${place.country}` : place.name;
    let results: Awaited<ReturnType<typeof search>> = [];
    try {
      results = await search(query);
    } catch (e) {
      console.log(`  ! ${place.name}: ${e instanceof Error ? e.message : e}`);
      continue;
    }

    const match = results.find(
      (r) =>
        guessCategory(r.category, r.type, r.addresstype) === "city" &&
        Math.abs(Number(r.lat) - place.lat) < SAME_PLACE_DEGREES &&
        Math.abs(Number(r.lon) - place.lng) < SAME_PLACE_DEGREES,
    );

    if (!match) {
      console.log(`  ·  ${place.name}${place.country ? ` — ${place.country}` : ""}`);
      continue;
    }

    const where = [place.city, place.country].filter(Boolean).join(", ");
    changing.push({ id: place.id, name: place.name, where });
    console.log(`  →  ${place.name}${where ? ` — ${where}` : ""}  becomes City`);
  }

  console.log(`\n${changing.length} of ${places.length} would become City`);

  if (!write) {
    console.log("Nothing was changed. Run again with --write to apply it.");
    return;
  }

  for (const row of changing) {
    await prisma.place.update({ where: { id: row.id }, data: { category: "city" } });
  }
  console.log(`Re-filed ${changing.length} place(s).`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
