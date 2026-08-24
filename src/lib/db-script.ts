/// Prisma client for the one-off scripts in scripts/ and prisma/. The app's
/// own client lives in src/lib/prisma.ts; this one exists because scripts run
/// outside Next and need to load .env themselves.
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is not set. Run `npm run db:dev` for a local Postgres.");
}

export const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

/// Scripts operate on one account. Takes the email from argv, falls back to
/// the only user when there is exactly one, and refuses to guess otherwise.
export async function resolveTargetUser(create = false) {
  const email = process.argv[2]?.trim().toLowerCase();

  if (email) {
    const user = create
      ? await prisma.user.upsert({
          where: { email },
          update: {},
          create: { email, name: email.split("@")[0] },
        })
      : await prisma.user.findUnique({ where: { email } });

    if (!user) throw new Error(`No account with email ${email}. Sign in once first.`);
    return user;
  }

  const users = await prisma.user.findMany({ take: 2 });
  if (users.length === 1) return users[0]!;
  if (users.length === 0) {
    throw new Error("No accounts yet — sign in once, then re-run with your email.");
  }
  throw new Error("More than one account exists. Pass the email to use, e.g. `-- you@example.com`.");
}
