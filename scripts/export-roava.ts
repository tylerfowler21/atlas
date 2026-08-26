/// Dumps every place and trip to JSON so nothing is lost across a database
/// change. Pairs with scripts/import-roava.ts.
///
///   npm run db:export            → roava-export.json

import "dotenv/config";
import { writeFileSync } from "node:fs";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "../src/generated/prisma/client";

const adapter = new PrismaBetterSqlite3({
  url: process.env.DATABASE_URL ?? "file:./prisma/dev.db",
});
const prisma = new PrismaClient({ adapter });

async function main() {
  const users = await prisma.user.findMany({
    include: {
      places: true,
      trips: { include: { items: true } },
    },
  });

  const out = { exportedAt: new Date().toISOString(), users };
  writeFileSync("roava-export.json", JSON.stringify(out, null, 2));

  const places = users.reduce((n, u) => n + u.places.length, 0);
  const trips = users.reduce((n, u) => n + u.trips.length, 0);
  console.log(`Wrote roava-export.json — ${places} places, ${trips} trips.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
