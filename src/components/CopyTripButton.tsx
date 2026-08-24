"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function CopyTripButton({
  tripId,
  signedIn,
  isOwn,
}: {
  tripId: string;
  signedIn: boolean;
  isOwn: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (isOwn) return null;
  if (!signedIn) {
    return (
      <a href="/signin" className="btn btn-ghost">
        Sign in to copy this
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
