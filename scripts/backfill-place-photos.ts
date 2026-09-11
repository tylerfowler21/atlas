/// Finds a Wikipedia photograph for every saved place that has not been looked
/// up yet.
///
/// Marks each place as checked whether or not anything was found, so a place
/// with no article is searched for once rather than on every run. Pass --again
/// to re-check the ones that came back empty.
import { prisma } from "../src/lib/db-script";
import { findPlacePhoto } from "../src/lib/place-photo";

const again = process.argv.includes("--again");

async function main() {
  const places = await prisma.place.findMany({
    where: again ? { photoUrl: null } : { photoCheckedAt: null },
    select: { id: true, name: true, lat: true, lng: true, city: true },
  });
  console.log(`${places.length} place(s) to look up`);

  let found = 0;
  for (const place of places) {
    let photo = null;
    try {
      photo = await findPlacePhoto(place);
    } catch (e) {
      console.log(`  ! ${place.name}: ${e instanceof Error ? e.message : e}`);
    }
    await prisma.place.update({
      where: { id: place.id },
      data: {
        photoUrl: photo?.url ?? null,
        photoAttribution: photo?.attribution ?? null,
        photoSourceUrl: photo?.sourceUrl ?? null,
        photoCheckedAt: new Date(),
      },
    });
    if (photo) found++;
    console.log(`  ${photo ? "✓" : "·"} ${place.name}${photo ? ` — ${photo.attribution}` : ""}`);
    // Wikimedia asks anonymous callers not to hammer it.
    await new Promise((r) => setTimeout(r, 250));
  }
  console.log(`\n${found} of ${places.length} got a photo`);
}

main().then(() => process.exit(0));
