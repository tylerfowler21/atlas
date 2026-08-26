import { NextResponse } from "next/server";

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

export function GET() {
  return NextResponse.json(
    {
      commit: (process.env.VERCEL_GIT_COMMIT_SHA ?? "local").slice(0, 7),
      branch: process.env.VERCEL_GIT_COMMIT_REF ?? null,
      environment: process.env.VERCEL_ENV ?? "development",
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
