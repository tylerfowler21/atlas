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
  const [answered, setAnswered] = useState(false);

  if (answered || !worthPublishing(trip, stops, owned)) return null;

  async function answer(publish: boolean) {
    setBusy(true);
    try {
      await fetch(`/api/trips/${tripId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(publish ? { published: true } : { publishAsked: true }),
      });
      setAnswered(true);
      if (publish) onPublished();
    } catch {
      // A failed offer should not become an error message about a trip
      // somebody was only reading. The switch in settings is still there.
      setAnswered(true);
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
