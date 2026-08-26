import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { mapkitConfigured, mapkitOrigin } from "@/lib/mapkit";

/// Which commit is actually running.
///
/// Several times now the question has been "did that deploy land?", and there
/// was no way to tell from outside: a change to server-only code leaves the
/// client bundles byte-identical, so even the asset fingerprints stay the same.
/// Vercel sets these automatically.
///
/// The commit hash is not a secret — it identifies a commit, it does not grant
/// access to one — and having it public is what makes a deployment verifiable
/// without dashboard access.
export const dynamic = "force-dynamic";

export async function GET() {
  const host = (await headers()).get("host");

  return NextResponse.json(
    {
      commit: (process.env.VERCEL_GIT_COMMIT_SHA ?? "local").slice(0, 7),
      branch: process.env.VERCEL_GIT_COMMIT_REF ?? null,
      environment: process.env.VERCEL_ENV ?? "development",
      // The site's own domain and whether Apple Maps is switched on. Neither is
      // a secret — the first is in the address bar and the second is visible
      // from which basemap the page draws — and having them here means a map
      // that falls back can be diagnosed with one request instead of a walk
      // through the admin pages.
      map: {
        appleConfigured: mapkitConfigured,
        tokenOrigin: mapkitOrigin(host ? `https://${host}` : null),
        requestHost: host,
      },
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
