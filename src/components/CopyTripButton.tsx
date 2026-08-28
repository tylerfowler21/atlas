"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function CopyTripButton({
  tripId,
  signedIn,
  isOwn,
  returnTo,
}: {
  tripId: string;
  signedIn: boolean;
  isOwn: boolean;
  /// This page, so signing in comes back to the trip somebody was reading
  /// rather than dropping them on their own empty map.
  returnTo: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (isOwn) return null;
  if (!signedIn) {
    // "Sign in" is the wrong word for somebody who has never been here, and
    // most people reading a shared trip have not.
    return (
      <a
        href={`/signin?next=${encodeURIComponent(returnTo)}`}
        className="btn btn-ghost"
      >
        Save this trip
      </a>
    );
  }

  async function copy() {
    setBusy(true);
    setError(null);

    const res = await fetch(`/api/trips/${tripId}/copy`, { method: "POST" });
    const body = await res.json().catch(() => ({}));

    if (!res.ok) {
      setBusy(false);
      setError(body.error ?? "Could not copy that trip");
      return;
    }
    router.push(`/trips/${body.tripId}`);
    router.refresh();
  }

  return (
    <div>
      <button type="button" className="btn btn-primary" disabled={busy} onClick={copy}>
        {busy ? "Copying…" : "Copy this trip"}
      </button>
      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
    </div>
  );
}
