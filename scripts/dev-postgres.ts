/// A real Postgres for local development, with nothing to install.
///
/// PGlite is Postgres compiled to WebAssembly; pglite-socket puts it behind
/// the actual Postgres wire protocol, so Prisma talks to it exactly as it will
/// talk to the hosted database in production. Data lives in ./.pgdata.
///
///   npm run db:dev

import { PGlite } from "@electric-sql/pglite";
import { PGLiteSocketServer } from "@electric-sql/pglite-socket";

const DATA_DIR = process.env.PGLITE_DIR ?? "./.pgdata";
// Deliberately not 5432, so this never collides with a real local Postgres.
const PORT = Number(process.env.PGLITE_PORT ?? 55432);

async function main() {
  const db = await PGlite.create(DATA_DIR);
  const server = new PGLiteSocketServer({
    db,
    port: PORT,
    host: "127.0.0.1",
    // Prisma opens a pool; one connection at a time would deadlock it.
    maxConnections: 10,
  });

  await server.start();
  console.log(
    `Local Postgres ready on postgresql://postgres:postgres@127.0.0.1:${PORT}/postgres`,
  );
  console.log(`Data directory: ${DATA_DIR} — delete it to start clean.`);

  const shutdown = async () => {
    await server.stop();
    await db.close();
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
