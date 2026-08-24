/// Who has signed up, and what they've done.
///
///   npm run db:users                                   (local)
///   DATABASE_URL="<production url>" npm run db:users   (live)

import { prisma } from "../src/lib/db-script";

function ago(date: Date) {
  const mins = Math.round((Date.now() - date.getTime()) / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 48) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

async function main() {
  const users = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      accounts: { select: { provider: true } },
      _count: { select: { places: true, trips: true } },
    },
  });

  if (users.length === 0) {
    console.log("No accounts yet.");
    return;
  }

  console.log(`${users.length} account${users.length === 1 ? "" : "s"}\n`);
  console.log(
    `  ${"signed up".padEnd(10)} ${"email".padEnd(34)} ${"via".padEnd(9)} places  trips`,
  );
  console.log(`  ${"-".repeat(74)}`);

  for (const u of users) {
    const via = u.accounts.map((a) => a.provider).join(",") || "dev-login";
    console.log(
      `  ${ago(u.createdAt).padEnd(10)} ${(u.email ?? "(no email)").padEnd(34)} ${via.padEnd(9)} ${String(u._count.places).padStart(6)} ${String(u._count.trips).padStart(6)}`,
    );
  }

  const shares = await prisma.tripShare.findMany({
    include: { trip: { select: { title: true, user: { select: { email: true } } } } },
    orderBy: { viewCount: "desc" },
  });

  if (shares.length > 0) {
    console.log(`\n${shares.length} shared link${shares.length === 1 ? "" : "s"}\n`);
    for (const s of shares) {
      console.log(
        `  "${s.trip.title}" by ${s.trip.user.email} — opened ${s.viewCount} time${s.viewCount === 1 ? "" : "s"}`,
      );
    }
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
