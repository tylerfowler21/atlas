"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/// Watch the welcome again, from an account that has already been through it.
export default function ReplayWelcome() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  return (
    <div>
      <h2 className="text-sm font-semibold">The welcome</h2>
      <p className="mt-1 text-xs text-muted">
        What somebody sees when they first sign up. Watching it again changes
        nothing — your places, trips and categories all stay exactly as they are.
      </p>
      <button
        type="button"
        className="btn btn-ghost mt-3"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          const res = await fetch("/api/replay-welcome", { method: "POST" });
          if (res.ok) {
            router.push("/welcome");
            router.refresh();
          } else {
            setBusy(false);
          }
        }}
      >
        {busy ? "Opening…" : "Show me the welcome again"}
      </button>
    </div>
  );
}
