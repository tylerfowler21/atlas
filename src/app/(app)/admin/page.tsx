import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin";

export const metadata: Metadata = { title: "Who's using Atlas" };
export const dynamic = "force-dynamic";

function ago(date: Date) {
  const mins = Math.round((Date.now() - date.getTime()) / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 48) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

export default async function AdminPage() {
  await requireAdmin();

  const [users, shares, totals] = await Promise.all([
    prisma.user.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        accounts: { select: { provider: true } },
        _count: { select: { places: true, trips: true, followers: true, following: true } },
      },
    }),
    prisma.tripShare.findMany({
      orderBy: { viewCount: "desc" },
      include: { trip: { select: { title: true, user: { select: { email: true } } } } },
    }),
    Promise.all([
      prisma.place.count(),
      prisma.trip.count(),
      prisma.trip.count({ where: { publishedAt: { not: null } } }),
      prisma.follow.count(),
    ]),
  ]);

  const [placeCount, tripCount, publishedCount, followCount] = totals;
  // The number that matters when you hand something to friends: how many got
  // past signing in and actually put something in.
  const active = users.filter((u) => u._count.places > 0 || u._count.trips > 0).length;

  const stats = [
    { label: "Accounts", value: users.length },
    { label: "Have added something", value: active },
    { label: "Places", value: placeCount },
    { label: "Trips", value: tripCount },
    { label: "Published", value: publishedCount },
    { label: "Follows", value: followCount },
  ];

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="text-xl font-semibold">Who&apos;s using Atlas</h1>
      <p className="mt-1 text-sm text-muted">
        Only you can see this. It shows other people&apos;s email addresses, so
        treat it as their data rather than yours.
      </p>

      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
        {stats.map((s) => (
          <div key={s.label} className="card px-4 py-3">
            <p className="text-2xl font-semibold tabular-nums">{s.value}</p>
            <p className="text-xs text-muted">{s.label}</p>
          </div>
        ))}
      </div>

      {users.length > active && (
        <p className="mt-3 text-xs text-muted">
          {users.length - active}{" "}
          {users.length - active === 1 ? "person has" : "people have"} signed in
          and added nothing yet — usually the most useful thing on this page.
        </p>
      )}

      <h2 className="mt-8 mb-2 text-sm font-medium">Accounts, newest first</h2>
      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line text-left text-xs text-muted">
              <th className="px-3 py-2 font-medium">Joined</th>
              <th className="px-3 py-2 font-medium">Who</th>
              <th className="px-3 py-2 font-medium">Via</th>
              <th className="px-3 py-2 text-right font-medium">Places</th>
              <th className="px-3 py-2 text-right font-medium">Trips</th>
              <th className="px-3 py-2 text-right font-medium">Followers</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-b border-line last:border-0">
                <td className="px-3 py-2 whitespace-nowrap text-muted">{ago(u.createdAt)}</td>
                <td className="px-3 py-2">
                  <span className="block truncate">{u.name ?? "—"}</span>
                  <span className="block truncate text-xs text-muted">{u.email}</span>
                  {u.username && (
                    <Link href={`/u/${u.username}`} className="text-xs text-accent hover:underline">
                      @{u.username}
                    </Link>
                  )}
                </td>
                <td className="px-3 py-2 text-xs whitespace-nowrap text-muted">
                  {u.accounts.map((a) => a.provider).join(", ") || "dev login"}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">{u._count.places}</td>
                <td className="px-3 py-2 text-right tabular-nums">{u._count.trips}</td>
                <td className="px-3 py-2 text-right tabular-nums">{u._count.followers}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2 className="mt-8 mb-2 text-sm font-medium">Shared links</h2>
      {shares.length === 0 ? (
        <p className="text-sm text-muted">Nobody has shared a trip yet.</p>
      ) : (
        <ul className="card divide-y divide-line overflow-hidden">
          {shares.map((s) => (
            <li key={s.id} className="flex items-center gap-3 px-3 py-2.5">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm">{s.trip.title}</p>
                <p className="truncate text-xs text-muted">{s.trip.user.email}</p>
              </div>
              <span className="shrink-0 text-xs text-muted tabular-nums">
                opened {s.viewCount}×
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
