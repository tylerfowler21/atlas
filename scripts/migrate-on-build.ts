/// Applies pending migrations as part of the build.
///
/// Shipping code that needs a table before the table exists takes the whole
/// site down — every signed-in page, including the settings page you would go
/// to in order to fix it. That happened because applying the migration was a
/// separate step done by hand, and a step done by hand is a step that gets
/// forgotten, or run against the wrong database.
///
/// The build environment already holds the production DATABASE_URL, so the
/// deploy is the one place that cannot get this wrong.
///
/// A failed migration fails the build on purpose. A deployment that goes out
/// against a schema it does not match is the thing worth preventing.
import { execFileSync } from "node:child_process";

/// The connection to run migrations over, which is not always the one the app
/// uses.
///
/// `migrate deploy` takes a session-level advisory lock so two deploys cannot
/// migrate at once. A connection pooler defeats that: it hands each statement
/// to whichever backend is free, so the session that took the lock is not the
/// session that holds it, and the wait times out at ten seconds with P1002.
/// Neon puts the pooler on a `-pooler` host, so migrations go to the direct one
/// instead. The app keeps using the pooled URL, which is what it wants.
///
/// DIRECT_URL wins if it is set, for a host that names its endpoints some other
/// way.
function migrationUrl(appUrl: string): { url: string; why: string } {
  const explicit = process.env["DIRECT_URL"];
  if (explicit) return { url: explicit, why: "DIRECT_URL" };

  try {
    const parsed = new URL(appUrl);
    if (parsed.hostname.includes("-pooler.")) {
      parsed.hostname = parsed.hostname.replace("-pooler.", ".");
      return { url: parsed.toString(), why: "direct endpoint (the pooled one cannot hold the lock)" };
    }
  } catch {
    // Not a URL we can take apart; use it as it came.
  }
  return { url: appUrl, why: "DATABASE_URL" };
}

const url = process.env["DATABASE_URL"];

if (!url) {
  // No database configured — a checkout with no .env, or a build that only
  // needs to typecheck. Nothing to migrate, and nothing worth failing over.
  console.log("[migrate] DATABASE_URL is not set, skipping migrations");
  process.exit(0);
}

// Says which database without printing the password.
const target = (() => {
  try {
    const { host, pathname } = new URL(url);
    return `${host}${pathname}`;
  } catch {
    return "the configured database";
  }
})();

const { url: migrateUrl, why } = migrationUrl(url);
console.log(`[migrate] applying migrations to ${target} via ${why}`);

/// Neon suspends an idle database and wakes it on the first connection, which
/// can take longer than the lock is willing to wait. One retry covers a cold
/// start; a second failure is a real problem and should stop the build.
function deploy() {
  execFileSync("npx", ["prisma", "migrate", "deploy"], {
    stdio: "inherit",
    env: { ...process.env, DATABASE_URL: migrateUrl },
  });
}

try {
  try {
    deploy();
  } catch {
    console.warn("\n[migrate] first attempt failed — retrying once in case the database was asleep\n");
    deploy();
  }
} catch {
  // The deploy output says what went wrong but not where the database stands,
  // and a build log is usually the only place anyone can look. Status names
  // every migration and which one is stuck, which is the difference between
  // fixing this and guessing at it.
  console.error("\n[migrate] FAILED. The state of the database:\n");
  try {
    execFileSync("npx", ["prisma", "migrate", "status"], {
      stdio: "inherit",
      env: { ...process.env, DATABASE_URL: migrateUrl },
    });
  } catch {
    // status exits non-zero whenever anything is pending; its output is what
    // matters, not its exit code.
  }
  console.error(
    [
      "",
      "[migrate] The build stops here on purpose: shipping code against a",
      "[migrate] schema it does not match takes the site down.",
      "",
      "[migrate] If a migration is listed as failed above, it must be resolved",
      "[migrate] before any deploy can succeed — `prisma migrate resolve",
      "[migrate] --rolled-back <name>` after undoing whatever it half-applied,",
      "[migrate] or `--applied <name>` if the change is in fact already there.",
      "",
    ].join("\n"),
  );
  process.exit(1);
}
