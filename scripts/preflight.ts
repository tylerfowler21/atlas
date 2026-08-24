/// Checks that an environment is actually ready to run Atlas, before you find
/// out from a white screen. Run it locally, and again with production values:
///
///   npm run preflight
///   npm run preflight -- https://your-domain.example
///
/// The optional URL is your deployed origin; it prints the exact Google
/// redirect URI to register for it.

import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const problems: string[] = [];
const warnings: string[] = [];
const notes: string[] = [];

function ok(label: string, detail = "") {
  console.log(`  ✓ ${label}${detail ? ` — ${detail}` : ""}`);
}

function bad(label: string, fix: string) {
  console.log(`  ✗ ${label}`);
  problems.push(`${label}\n      fix: ${fix}`);
}

function warn(label: string, detail: string) {
  console.log(`  ! ${label}`);
  warnings.push(`${label}\n      ${detail}`);
}

async function checkDatabase() {
  console.log("\nDatabase");
  const url = process.env.DATABASE_URL;

  if (!url) {
    bad("DATABASE_URL is not set", "Local: run `npm run db:dev`. Deployed: paste your Postgres connection string.");
    return;
  }
  if (!/^postgres(ql)?:\/\//.test(url)) {
    bad("DATABASE_URL is not a Postgres URL", "Atlas moved from SQLite to Postgres; the value must start with postgresql://");
    return;
  }
  ok("DATABASE_URL is set", url.replace(/:\/\/([^:]+):[^@]*@/, "://$1:****@"));

  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });
  try {
    await prisma.$queryRaw`SELECT 1`;
    ok("database reachable");

    // If the tables are missing, every page 500s at runtime rather than here.
    const users = await prisma.user.count();
    ok("schema applied", `${users} account${users === 1 ? "" : "s"}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    // Prisma wraps the real cause in boilerplate ("Invalid `prisma.x()`
    // invocation:" then blank lines). The cause is the last line that says
    // something.
    const lines = message
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line && !line.endsWith("invocation:"));
    const summary =
      lines.at(-1) ?? (error instanceof Error ? error.name : "unknown error");

    if (/does not exist|relation/i.test(message)) {
      bad("schema is not applied", "Run `npm run db:migrate` against this DATABASE_URL.");
    } else {
      bad(
        `cannot reach the database — ${summary}`,
        "Check the connection string, and that `npm run db:dev` is running for local work.",
      );
    }
  } finally {
    await prisma.$disconnect();
  }
}

function checkAuth() {
  console.log("\nSign-in");

  const secret = process.env.AUTH_SECRET ?? "";
  if (!secret) {
    bad("AUTH_SECRET is not set", "Generate one: openssl rand -base64 33");
  } else if (secret.length < 32) {
    bad("AUTH_SECRET is too short", "Generate a proper one: openssl rand -base64 33");
  } else {
    ok("AUTH_SECRET is set");
  }

  const id = process.env.AUTH_GOOGLE_ID;
  const secretValue = process.env.AUTH_GOOGLE_SECRET;

  if (id && secretValue) {
    ok("Google sign-in configured");
    if (!id.endsWith(".apps.googleusercontent.com")) {
      warn(
        "AUTH_GOOGLE_ID does not look like a Google client ID",
        "It normally ends in .apps.googleusercontent.com — check you pasted the client ID and not the project id.",
      );
    }
  } else {
    warn(
      "Google sign-in is NOT configured",
      "Set AUTH_GOOGLE_ID and AUTH_GOOGLE_SECRET. Without them nobody can sign in (shared links still work).",
    );
  }

  if (process.env.ALLOW_DEV_LOGIN === "true") {
    notes.push(
      "Dev login is ON. Fine locally — it is ignored by production builds — but never set ALLOW_DEV_LOGIN on a deployed environment.",
    );
  }
}

function checkRedirectUri() {
  const origin = process.argv[2]?.trim().replace(/\/+$/, "");
  console.log("\nGoogle redirect URIs to register");
  console.log("  http://localhost:3100/api/auth/callback/google");
  if (origin) {
    console.log(`  ${origin}/api/auth/callback/google`);
  } else {
    notes.push(
      "Pass your deployed origin to see its redirect URI, e.g. `npm run preflight -- https://atlas.vercel.app`.",
    );
  }
  console.log("  (Google matches these character for character.)");
}

async function main() {
  console.log("Atlas preflight");
  await checkDatabase();
  checkAuth();
  checkRedirectUri();

  if (warnings.length) {
    console.log("\nWarnings");
    warnings.forEach((w) => console.log(`  ! ${w}`));
  }
  if (notes.length) {
    console.log("\nNotes");
    notes.forEach((n) => console.log(`  · ${n}`));
  }

  if (problems.length) {
    console.log("\nNot ready yet:");
    problems.forEach((p) => console.log(`  ✗ ${p}`));
    process.exit(1);
  }

  console.log("\nReady.\n");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
