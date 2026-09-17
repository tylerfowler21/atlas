"use client";

import { useEffect, useState } from "react";
import Otto, { OTTO_FOR } from "@/components/Otto";

/// Asking Otto to fill an empty day.
///
/// He proposes and never writes. What comes back is a list of entries in the
/// shape the importer already takes, so this shows them the way a pasted
/// itinerary is shown — every row with a tick beside it — and posts only the
/// ones still ticked. Nothing reaches the trip that somebody did not look at.
///
/// He is not offered to everybody yet: the endpoint answers whether to draw
/// him at all, and says no to anyone outside ADMIN_EMAILS. When that comes
/// off, nothing here changes.

type OttoPlace = {
  name: string;
  lat: number;
  lng: number;
  address: string | null;
  city: string | null;
  country: string | null;
  countryCode: string | null;
};

type OttoEntry = {
  kind: "stop" | "travel";
  dayIndex: number;
  title: string;
  startTime: string | null;
  endTime: string | null;
  notes: string | null;
  category: string;
  mode: string | null;
  place: OttoPlace | null;
  toPlace: OttoPlace | null;
};

type Stage = "closed" | "offering" | "asking" | "reviewing" | "saving";

export default function AskOtto({
  tripId,
  dayIndex,
  onApplied,
}: {
  tripId: string;
  dayIndex: number;
  /// Called once stops have actually been added, so the day can re-read
  /// itself. The list lives in state seeded from props; a router refresh
  /// would not reach it.
  onApplied: () => void | Promise<void>;
}) {
  const [stage, setStage] = useState<Stage>("closed");
  const [remaining, setRemaining] = useState<number | null>(null);
  const [say, setSay] = useState("");
  const [entries, setEntries] = useState<OttoEntry[]>([]);
  const [chosen, setChosen] = useState<Set<number>>(new Set());
  const [failed, setFailed] = useState("");

  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const res = await fetch(`/api/trips/${tripId}/otto`);
        if (!res.ok) return;
        const body = (await res.json()) as { available: boolean; remaining: number };
        if (!alive || !body.available) return;
        setRemaining(body.remaining);
        setStage("offering");
      } catch {
        // He is an offer, not a feature anybody is waiting on. If the question
        // fails he simply is not there.
      }
    })();
    return () => {
      alive = false;
    };
  }, [tripId]);

  async function ask() {
    setStage("asking");
    setFailed("");
    try {
      const res = await fetch(`/api/trips/${tripId}/otto`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dayIndex }),
      });
      const body = (await res.json()) as {
        say?: string;
        entries?: OttoEntry[];
        remaining?: number;
        error?: string;
      };
      if (!res.ok) throw new Error(body.error ?? "He could not finish that.");
      setSay(body.say ?? "");
      setEntries(body.entries ?? []);
      setChosen(new Set((body.entries ?? []).map((_, i) => i)));
      if (typeof body.remaining === "number") setRemaining(body.remaining);
      setStage("reviewing");
    } catch (e) {
      setFailed(e instanceof Error ? e.message : "He could not finish that.");
      setStage("offering");
    }
  }

  async function keep() {
    const taking = entries.filter((_, i) => chosen.has(i));
    if (taking.length === 0) {
      setStage("offering");
      return;
    }
    setStage("saving");
    setFailed("");
    try {
      const res = await fetch("/api/trips/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tripId,
          // A day being planned is a day nobody has been to yet.
          markVisited: false,
          entries: taking,
        }),
      });
      const body = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(body.error ?? "Could not add those.");
      await onApplied();
      setStage("closed");
    } catch (e) {
      setFailed(e instanceof Error ? e.message : "Could not add those.");
      setStage("reviewing");
    }
  }

  if (stage === "closed") return null;

  return (
    <div className="mt-4 rounded-2xl border border-line bg-surface p-4">
      <div className="flex items-start gap-3">
        <Otto
          pose={
            stage === "asking"
              ? OTTO_FOR.thinking
              : stage === "reviewing" && entries.length === 0
                ? OTTO_FOR.empty
                : stage === "reviewing"
                  ? OTTO_FOR.found
                  : OTTO_FOR.resting
          }
          alive={stage === "asking"}
        />

        <div className="min-w-0 flex-1">
          {stage === "offering" && (
            <>
              <p className="text-sm">
                Nothing on this day yet. I can put something together from what is
                already on the trip.
              </p>
              <p className="mt-1 text-xs text-muted">
                I read the days either side, look for real places nearby, and show
                you what I found. Nothing is saved until you say so.
              </p>
            </>
          )}

          {stage === "asking" && (
            <p className="text-sm text-muted">Reading the trip and looking around…</p>
          )}

          {(stage === "reviewing" || stage === "saving") && (
            <>
              {say && <p className="whitespace-pre-line text-sm">{say}</p>}
              {entries.length === 0 ? (
                <p className="mt-1 text-xs text-muted">
                  Nothing worth adding, so nothing added. That one was free.
                </p>
              ) : (
                <ul className="mt-3 space-y-1.5">
                  {entries.map((entry, i) => (
                    <li key={`${entry.title}-${i}`}>
                      <label className="flex cursor-pointer items-start gap-2.5 text-sm">
                        <input
                          type="checkbox"
                          id={`otto-${dayIndex}-${i}`}
                          className="mt-1"
                          checked={chosen.has(i)}
                          onChange={() =>
                            setChosen((prev) => {
                              const next = new Set(prev);
                              if (next.has(i)) next.delete(i);
                              else next.add(i);
                              return next;
                            })
                          }
                        />
                        <span className="min-w-0">
                          <span className="font-medium">
                            {entry.startTime ? `${entry.startTime} · ` : ""}
                            {entry.title}
                          </span>
                          {entry.place?.city && (
                            <span className="text-muted"> — {entry.place.city}</span>
                          )}
                          {entry.notes && (
                            <span className="block text-xs text-muted">{entry.notes}</span>
                          )}
                        </span>
                      </label>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}

          {failed && <p className="mt-2 text-xs text-danger">{failed}</p>}

          <div className="mt-3 flex flex-wrap items-center gap-2">
            {stage === "offering" && (
              <>
                <button type="button" className="btn btn-accent text-sm" onClick={() => void ask()}>
                  Fill day {dayIndex + 1}
                </button>
                <button
                  type="button"
                  className="btn btn-ghost text-sm"
                  onClick={() => setStage("closed")}
                >
                  Not now
                </button>
              </>
            )}

            {stage === "reviewing" && entries.length > 0 && (
              <>
                <button type="button" className="btn btn-accent text-sm" onClick={() => void keep()}>
                  Add {chosen.size} {chosen.size === 1 ? "stop" : "stops"}
                </button>
                <button
                  type="button"
                  className="btn btn-ghost text-sm"
                  onClick={() => setStage("closed")}
                >
                  Discard
                </button>
              </>
            )}

            {stage === "reviewing" && entries.length === 0 && (
              <button
                type="button"
                className="btn btn-ghost text-sm"
                onClick={() => setStage("closed")}
              >
                Close
              </button>
            )}

            {stage === "saving" && <span className="text-xs text-muted">Adding…</span>}

            {/* Said where it is relevant rather than as a running total
                somewhere else: the number only matters while deciding whether
                to spend one. */}
            {remaining !== null && stage === "offering" && (
              <span className="text-xs text-muted">
                {remaining} left this month
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
