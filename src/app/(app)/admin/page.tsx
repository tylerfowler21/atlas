import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin";
import { appleSecretDaysLeft, appleSecretExpiry } from "@/auth";
import { checkAppleCredentials } from "@/lib/apple-check";
import { inspectAppleSecret } from "@/lib/apple-secret-inspect";
import { mapkitConfigured } from "@/lib/mapkit";

export const metadata: Metadata = { title: "Who's using Roava" };
export const dynamic = "force-dynamic";

function ago(date: Date) {
  const mins = Math.round((Date.now() - date.getTime()) / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 48) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

/// Uses whatever host this deployment is being served on, so the check is
/// correct on a preview URL and on a custom domain without being told.
async function verifyApple() {
  const host = (await headers()).get("host");
  return checkAppleCredentials(`https://${host}/api/auth/callback/apple`);
}

/// Presence, never values. Reading whether a variable is set is a diagnostic;
/// printing what it contains would put credentials on a web page.
const SETTINGS = [
  { name: "AUTH_SECRET", enables: "all sign-in" },
  { name: "APPLE_TEAM_ID", enables: "Apple Maps and app sign-in" },
  { name: "MAPKIT_KEY_ID", enables: "Apple Maps" },
  { name: "MAPKIT_PRIVATE_KEY", enables: "Apple Maps" },
  { name: "AUTH_APPLE_ID", enables: "Continue with Apple" },
  { name: "AUTH_APPLE_SECRET", enables: "Continue with Apple" },
  { name: "APPLE_BUNDLE_ID", enables: "iOS app sign-in" },
  { name: "AUTH_GOOGLE_ID", enables: "Continue with Google" },
  { name: "AUTH_GOOGLE_SECRET", enables: "Continue with Google" },
  { name: "BLOB_READ_WRITE_TOKEN", enables: "photo uploads" },
].map((setting) => ({ ...setting, set: Boolean(process.env[setting.name]) }));

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ verify?: string }>;
}) {
  // Behind a query parameter rather than automatic: it calls Apple, and this
  // page should not depend on their servers being reachable to render.
  const { verify } = await searchParams;
  const appleExpiry = appleSecretExpiry();
  const appleExpiresInDays = appleSecretDaysLeft() ?? 0;
  await requireAdmin();

  const appleCheck = verify === "apple" ? await verifyApple() : null;

  const apple = inspectAppleSecret();

  // The origin a MapKit token would be minted for. MapKit refuses a token whose
  // origin does not match the page requesting it, and the map then falls back
  // to the free basemap without saying why — so this is the one value that
  // explains an Apple Maps that quietly is not Apple Maps.
  const requestHost = (await headers()).get("host");
  const mapkitOrigin = requestHost ? `https://${requestHost}` : null;

  const authErrors = await prisma.authError.findMany({
    orderBy: { createdAt: "desc" },
    take: 5,
  });

  const [reports, users, shares, totals] = await Promise.all([
    prisma.report.findMany({
      where: { reviewedAt: null },
      orderBy: { createdAt: "desc" },
      take: 50,
      include: {
        targetUser: { select: { username: true, email: true } },
        reporter: { select: { username: true, email: true } },
      },
    }),
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
      <h1 className="text-xl font-semibold">Who&apos;s using Roava</h1>
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

      {reports.length > 0 && (
        <>
          <h2 className="mt-8 mb-2 text-sm font-medium text-red-500">
            {reports.length} unreviewed {reports.length === 1 ? "report" : "reports"}
          </h2>
          <ul className="card divide-y divide-line overflow-hidden border-red-500/40">
            {reports.map((r) => (
              <li key={r.id} className="px-3 py-2.5">
                <p className="text-sm">
                  <span className="font-medium">{r.reason}</span>
                  {r.targetUser && (
                    <>
                      {" — "}
                      {r.targetUser.username
                        ? `@${r.targetUser.username}`
                        : r.targetUser.email}
                    </>
                  )}
                  {r.tripId && !r.targetUser && <> — a published trip</>}
                </p>
                {r.note && <p className="mt-0.5 text-xs text-muted">{r.note}</p>}
                <p className="mt-0.5 text-xs text-muted">
                  {ago(r.createdAt)} ·{" "}
                  {r.reporter
                    ? `reported by ${r.reporter.username ?? r.reporter.email}`
                    : "reported anonymously"}
                  {r.tripId && (
                    <>
                      {" · "}
                      <Link href={`/t/${r.tripId}`} className="text-accent-text hover:underline">
                        view the trip
                      </Link>
                    </>
                  )}
                </p>
              </li>
            ))}
          </ul>
        </>
      )}

      {authErrors.length > 0 && (
        <>
          <h2 className="mt-8 mb-2 text-sm font-medium text-red-500">
            Recent sign-in failures
          </h2>
          <ul className="card divide-y divide-line">
            {authErrors.map((e) => (
              <li key={e.id} className="px-3 py-2">
                <p className="text-xs font-medium">{e.kind}</p>
                <p className="mt-1 font-mono text-xs break-words text-muted">
                  {e.message}
                </p>
                {e.stack && (
                  <pre className="mt-1 max-h-40 overflow-auto rounded bg-background p-2 font-mono text-[10px] leading-relaxed text-muted">
                    {e.stack}
                  </pre>
                )}
                <p className="mt-1 text-xs text-muted">
                  {e.createdAt.toLocaleString()}
                </p>
              </li>
            ))}
          </ul>
        </>
      )}

      <h2 className="mt-8 mb-2 text-sm font-medium">Apple Maps</h2>
      <ul className="card divide-y divide-line text-xs">
        <li className="flex gap-3 px-3 py-1.5">
          <span className="text-muted">configured</span>
          <span className="ml-auto font-mono">{mapkitConfigured ? "yes" : "no"}</span>
        </li>
        <li className="flex gap-3 px-3 py-1.5">
          <span className="text-muted">token origin claim</span>
          <span className="ml-auto font-mono break-all">{mapkitOrigin ?? "—"}</span>
        </li>
        <li className="px-3 py-1.5 text-muted">
          The origin must match the address in the browser&apos;s bar exactly. If
          it does not, MapKit rejects the token and the map falls back to the
          free basemap without reporting anything.
        </li>
      </ul>

      <h2 className="mt-8 mb-2 text-sm font-medium">Apple credentials on this deployment</h2>
      <ul className="card divide-y divide-line text-xs">
        {[
          ["AUTH_APPLE_ID (quoted)", apple.clientIdQuoted ?? "not set"],
          ["secret length", apple.secretLength === null ? "not set" : `${apple.secretLength} characters`],
          ["signed by key", apple.keyId ?? "could not decode"],
          ["team (iss)", apple.teamId ?? "—"],
          ["subject (sub)", apple.subject ?? "—"],
          ["audience (aud)", apple.audience ?? "—"],
          ["expires", apple.expiresAt ?? "—"],
        ].map(([label, value]) => (
          <li key={label} className="flex gap-3 px-3 py-1.5">
            <span className="text-muted">{label}</span>
            <span className="ml-auto font-mono break-all">{value}</span>
          </li>
        ))}
        <li className="flex gap-3 px-3 py-1.5">
          <span className="text-muted">subject matches client id</span>
          <span
            className={`ml-auto font-medium ${
              apple.subjectMatchesClientId
                ? "text-emerald-600 dark:text-emerald-400"
                : "text-red-500"
            }`}
          >
            {apple.subjectMatchesClientId === null
              ? "—"
              : apple.subjectMatchesClientId
                ? "yes"
                : "NO — Apple rejects the pair"}
          </span>
        </li>
        {apple.looksWhitespaceDamaged && (
          <li className="px-3 py-1.5 text-red-500">
            A value has leading or trailing whitespace — re-paste it in Vercel.
          </li>
        )}
      </ul>

      <h2 className="mt-8 mb-2 text-sm font-medium">Configuration</h2>
      {appleCheck ? (
        <p
          className={`card mb-2 px-3 py-2 text-xs ${
            appleCheck.ok ? "text-emerald-600 dark:text-emerald-400" : "text-red-500"
          }`}
        >
          <strong>{appleCheck.ok ? "Apple sign-in works." : "Apple sign-in is broken."}</strong>{" "}
          {appleCheck.detail}
        </p>
      ) : (
        <p className="mb-2 text-xs">
          <Link href="/admin?verify=apple" className="text-accent-text hover:underline">
            Ask Apple whether this deployment&apos;s sign-in credentials work →
          </Link>
        </p>
      )}
      <p className="mb-2 text-xs text-muted">
        Whether each setting is present on this deployment. Names only — no
        values are read or shown. A variable added in Vercel does not reach a
        deployment that was already running, so anything unexpected here is
        usually a missing redeploy or a variable saved to Preview but not
        Production.
      </p>
      <ul className="card divide-y divide-line text-sm">
        {SETTINGS.map((setting) => (
          <li key={setting.name} className="flex items-baseline gap-3 px-3 py-2">
            <code className="text-xs">{setting.name}</code>
            <span className="text-xs text-muted">{setting.enables}</span>
            <span
              className={`ml-auto text-xs font-medium ${
                setting.set ? "text-emerald-600 dark:text-emerald-400" : "text-red-500"
              }`}
            >
              {setting.set ? "set" : "missing"}
            </span>
          </li>
        ))}
      </ul>

      {appleExpiry && (
        <>
          <h2 className="mt-8 mb-2 text-sm font-medium">Apple sign-in</h2>
          <p
            className={`card px-3 py-2 text-xs ${
              appleExpiresInDays < 14 ? "text-red-500" : "text-muted"
            }`}
          >
            The Apple client secret expires{" "}
            <strong>{appleExpiry.toLocaleDateString()}</strong> — in{" "}
            {appleExpiresInDays} {appleExpiresInDays === 1 ? "day" : "days"}.
            Apple signs these for six months at most. Regenerate with{" "}
            <code>npm run apple:secret</code> and update{" "}
            <code>AUTH_APPLE_SECRET</code>; when it lapses, every Apple sign-in
            fails at once.
          </p>
        </>
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
                    <Link href={`/u/${u.username}`} className="text-xs text-accent-text hover:underline">
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
