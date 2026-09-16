"use client";

import { useState } from "react";
import { type PublishCandidate, worthPublishing } from "@/lib/publish-prompt";

/// The offer to put a finished trip on your profile.
///
/// Publishing was a switch in the trip's settings, and two accounts in
/// twenty-four had ever found it. This asks instead — once, on the trip
/// itself, at the point the trip is over and there is something on it worth
/// reading.
///
/// Both answers are final. Yes publishes; no is remembered, so nobody is asked
/// twice about the same trip.

export default function PublishPrompt({
  tripId,
  trip,
  stops,
  owned,
  onPublished,
}: {
  tripId: string;
  trip: PublishCandidate;
  stops: number;
  owned: boolean;
  onPublished: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [answered, setAnswered] = useState<"no" | "yes" | null>(null);
  const [copied, setCopied] = useState(false);

  /// Where it now lives, which is the thing nobody was ever told.
  ///
  /// The page has existed all along and is linked from feed cards and
  /// profiles — everywhere except the trip itself, so the one person
  /// guaranteed to want the address was the one person never given it.
  const url = typeof window === "undefined" ? "" : `${window.location.origin}/t/${tripId}`;

  if (answered === "yes") {
    return (
      <div className="card mt-4 p-4">
        <p className="text-sm font-medium">It&apos;s on your profile.</p>
        <p className="mt-1 text-sm text-muted">
          Anyone with this link can read it, with or without an account.
        </p>
        <div className="mt-3 flex items-center gap-2">
          <input
            readOnly
            value={url}
            onFocus={(e) => e.currentTarget.select()}
            className="input min-w-0 flex-1 text-xs"
            aria-label="Link to this trip"
          />
          <button
            type="button"
            className="btn"
            onClick={() => {
              void navigator.clipboard?.writeText(url);
              setCopied(true);
            }}
          >
            {copied ? "Copied" : "Copy"}
          </button>
        </div>
      </div>
    );
  }

  if (answered === "no" || !worthPublishing(trip, stops, owned)) return null;

  async function answer(publish: boolean) {
    setBusy(true);
    try {
      await fetch(`/api/trips/${tripId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(publish ? { published: true } : { publishAsked: true }),
      });
      setAnswered(publish ? "yes" : "no");
      if (publish) onPublished();
    } catch {
      // A failed offer should not become an error message about a trip
      // somebody was only reading. The switch in settings is still there.
      setAnswered("no");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card mt-4 p-4">
      <p className="text-sm font-medium">This one looks finished.</p>
      <p className="mt-1 text-sm text-muted">
        Putting it on your profile lets people read the itinerary — the days and
        the stops, as you wrote them. Your journal entries stay private.
      </p>
      <div className="mt-3 flex items-center gap-4">
        <button
          type="button"
          disabled={busy}
          onClick={() => void answer(true)}
          className="btn btn-primary"
        >
          Put it on my profile
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => void answer(false)}
          className="text-sm text-muted hover:underline"
        >
          Not this one
        </button>
      </div>
    </div>
  );
}
