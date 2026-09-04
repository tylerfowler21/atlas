"use client";

import { useEffect, useState } from "react";

type Share = {
  id: string;
  area: string;
  categories: string[];
  statuses: string[];
  note: string | null;
  path: string;
  viewCount: number;
  createdAt: string;
};

/// The links you have handed out, and the way to take them back.
///
/// A secret link is a credential: anybody holding it can read the places it
/// covers, forever, and it keeps working as you add more. That is the point of
/// it, and it is also why there has to be somewhere to see what is out there
/// and revoke it.
export default function SharedAreas() {
  const [shares, setShares] = useState<Share[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/place-shares");
        if (!res.ok) return;
        const { shares: found } = (await res.json()) as { shares: Share[] };
        if (!cancelled) setShares(found);
      } catch {
        // Nothing to show is the same as nothing loaded, for this list.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!shares || shares.length === 0) return null;

  async function revoke(share: Share) {
    if (
      !window.confirm(
        `Revoke the ${share.area} link?\n\nAnyone you sent it to will stop being able to open it.`,
      )
    ) {
      return;
    }
    const res = await fetch(`/api/place-shares/${share.id}`, { method: "DELETE" });
    if (res.ok) setShares((current) => (current ?? []).filter((s) => s.id !== share.id));
  }

  return (
    <div>
      <h2 className="text-sm font-semibold">Places you&apos;ve shared</h2>
      <p className="mt-1 text-xs text-muted">
        These links stay up to date as you add places. Revoking one stops it
        working for everybody you sent it to.
      </p>

      <ul className="mt-3 space-y-2">
        {shares.map((share) => (
          <li key={share.id} className="rounded-lg border border-line px-3 py-2">
            <div className="flex items-center gap-3">
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">{share.area}</span>
                <span className="block truncate text-xs text-muted">
                  {share.categories.length === 0
                    ? "Everything"
                    : `${share.categories.length} categories`}
                  {" · "}
                  {share.viewCount === 0
                    ? "not opened yet"
                    : `opened ${share.viewCount} ${share.viewCount === 1 ? "time" : "times"}`}
                </span>
              </span>
              <button
                type="button"
                className="btn btn-ghost shrink-0 text-xs"
                onClick={async () => {
                  await navigator.clipboard.writeText(
                    `${window.location.origin}${share.path}`,
                  );
                }}
              >
                Copy
              </button>
              <button
                type="button"
                className="shrink-0 text-xs text-muted hover:underline"
                onClick={() => void revoke(share)}
              >
                Revoke
              </button>
            </div>
            {share.note && <p className="mt-1 text-xs text-muted">{share.note}</p>}
          </li>
        ))}
      </ul>
    </div>
  );
}
