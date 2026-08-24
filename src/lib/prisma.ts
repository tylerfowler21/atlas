import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error(
    "DATABASE_URL is not set. Copy .env.example to .env, and run `npm run db:dev` for a local Postgres.",
  );
}

const adapter = new PrismaPg({ connectionString });

export const prisma = globalForPrisma.prisma ?? new PrismaClient({ adapter });

// Next's dev server re-evaluates modules on every change; without this the
// pool would be recreated until Postgres refuses new connections.
if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
