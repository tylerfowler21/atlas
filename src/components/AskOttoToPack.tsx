"use client";

import { useState } from "react";
import Otto from "@/components/Otto";
import { PACKING_KIND } from "@/lib/resources";
import type { TripResourceDTO } from "@/lib/types";

/// Otto, asked what to pack.
///
/// The same bargain as everywhere else he works: he suggests, you tick, and
/// only the ticked ones are saved. A packing list is the mildest thing in the
/// app to get wrong — a wrong row is one tap to remove — but the rule is not
/// about stakes. Somebody who has once had a list rearranged without being
/// asked stops trusting the thing that did it.

type Suggested = { label: string; because: string | null };

export default function AskOttoToPack({
  tripId,
  onAdded,
}: {
  tripId: string;
  onAdded: (added: TripResourceDTO[]) => void;
}) {
  const [stage, setStage] = useState<"offering" | "thinking" | "reviewing" | "saving">("offering");
  const [say, setSay] = useState("");
  const [items, setItems] = useState<Suggested[]>([]);
  const [chosen, setChosen] = useState<Set<number>>(new Set());
  const [remaining, setRemaining] = useState<number | null>(null);
  const [failed, setFailed] = useState<string | null>(null);

  async function ask() {
    setStage("thinking");
    setFailed(null);
    try {
      const res = await fetch(`/api/trips/${tripId}/packing`, { method: "POST" });
      const body = (await res.json()) as {
        say?: string;
        items?: Suggested[];
        remaining?: number;
        error?: string;
      };
      if (!res.ok) throw new Error(body.error ?? "That didn't work");
      setSay(body.say ?? "");
      setItems(body.items ?? []);
      // Everything ticked to begin with: he was asked, and a list that arrives
      // switched off makes somebody do the work twice.
      setChosen(new Set((body.items ?? []).map((_, i) => i)));
      if (typeof body.remaining === "number") setRemaining(body.remaining);
      setStage("reviewing");
    } catch (e) {
      setFailed(e instanceof Error ? e.message : "That didn't work");
      setStage("offering");
    }
  }

  async function keep() {
    setStage("saving");
    const wanted = items.filter((_, i) => chosen.has(i));
    const added: TripResourceDTO[] = [];
    try {
      // One at a time, in order, so they land in the order he suggested them
      // rather than whichever request came back first.
      for (const item of wanted) {
        const res = await fetch(`/api/trips/${tripId}/resources`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ label: item.label, kind: PACKING_KIND }),
        });
        const body = await res.json();
        if (!res.ok) throw new Error(body.error ?? "Could not add those");
        added.push(body.resource);
      }
      onAdded(added);
      setStage("offering");
      setItems([]);
    } catch (e) {
      // Whatever did save stays saved — the list shows it, and asking again
      // will not offer those twice.
      if (added.length > 0) onAdded(added);
      setFailed(e instanceof Error ? e.message : "Could not add those");
      setStage("reviewing");
    }
  }

  return (
    <div className="mt-3 rounded-xl border border-line p-3">
      <div className="flex items-start gap-3">
        <Otto pose={stage === "thinking" ? "thinking" : "planning"} />
        <div className="min-w-0 flex-1">
          {stage === "offering" && (
            <p className="text-sm text-muted">
              Otto can suggest what this trip needs — where it goes, what the
              weather does there, and what you already have on the list.
            </p>
          )}

          {stage === "thinking" && <p className="text-sm text-muted">Thinking…</p>}

          {(stage === "reviewing" || stage === "saving") && (
            <>
              {say && <p className="text-sm">{say}</p>}
              {items.length === 0 ? (
                <p className="mt-1 text-sm text-muted">
                  Nothing to add — the list already covers it.
                </p>
              ) : (
                <ul className="mt-2 space-y-1">
                  {items.map((item, i) => (
                    <li key={`${item.label}-${i}`}>
                      <label className="flex items-start gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={chosen.has(i)}
                          onChange={(e) => {
                            setChosen((was) => {
                              const next = new Set(was);
                              if (e.target.checked) next.add(i);
                              else next.delete(i);
                              return next;
                            });
                          }}
                          className="mt-0.5 size-4 shrink-0 accent-[color:var(--accent)]"
                        />
                        <span className="min-w-0">
                          {item.label}
                          {item.because && (
                            <span className="block text-xs text-muted">{item.because}</span>
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
              <button type="button" className="btn btn-accent text-sm" onClick={() => void ask()}>
                Ask Otto what to pack
              </button>
            )}

            {stage === "reviewing" && items.length > 0 && (
              <>
                <button type="button" className="btn btn-accent text-sm" onClick={() => void keep()}>
                  Add {chosen.size} {chosen.size === 1 ? "thing" : "things"}
                </button>
                <button
                  type="button"
                  className="btn btn-ghost text-sm"
                  onClick={() => {
                    setItems([]);
                    setStage("offering");
                  }}
                >
                  Discard
                </button>
              </>
            )}

            {stage === "saving" && <span className="text-xs text-muted">Adding…</span>}

            {/* Said while deciding whether to spend one, which is the only
                moment the number matters. */}
            {remaining !== null && stage === "offering" && (
              <span className="text-xs text-muted">{remaining} left this month</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
