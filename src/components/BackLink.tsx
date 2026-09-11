"use client";

import { useRouter } from "next/navigation";

/// A way back from a page you arrived at by clicking something.
///
/// The decision happens on the click rather than during render. History is a
/// browser fact with no server equivalent, so reading it to choose what to
/// draw means either a button that changes under the cursor after hydration,
/// or setting state from an effect. Deciding when pressed avoids both: browser
/// history where there is any, since the honest answer to "back" is wherever
/// you actually came from, and somewhere sensible where there is not — a trip
/// opened from a message has no history to return to.
export default function BackLink({ fallback }: { fallback: string }) {
  const router = useRouter();

  return (
    <button
      type="button"
      className="text-xs text-accent-text hover:underline"
      onClick={() => {
        if (window.history.length > 1) router.back();
        else router.push(fallback);
      }}
    >
      ← Back
    </button>
  );
}
