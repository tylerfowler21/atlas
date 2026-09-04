"use client";

import { useState } from "react";
import { useCategories } from "@/components/CategoriesProvider";
import { STATUSES } from "@/lib/taxonomy";
import { placeName } from "@/lib/place-name";
import type { PlaceDTO } from "@/lib/types";

/// Handing somebody the part of a city you think they should know about.
///
/// The categories are the point. "Where should I eat in Charleston" and "what
/// should I do in Charleston" are different questions, and the person sharing
/// is the one who knows which they are answering — so the link carries a
/// choice rather than everything you have ever saved there.
export default function ShareArea({
  area,
  places,
  onPreview,
  onClose,
}: {
  area: string;
  /// Everything saved here, unfiltered. The map behind shows the link on a
  /// laptop, but on a phone this panel covers the map completely — so the list
  /// says what is in it either way.
  places: PlaceDTO[];
  /// Reports what the link currently covers, so the map behind can show it.
  /// Choosing what to include is a visual question, and it cannot be answered
  /// from a row of chips while the map shows something else.
  onPreview: (covers: { categories: string[]; statuses: string[] }) => void;
  onClose: () => void;
}) {
  const { categories, categoryOf } = useCategories();

  const [chosen, setChosen] = useState<Set<string>>(new Set());
  const [statuses, setStatuses] = useState<Set<string>>(new Set(["visited", "lived"]));
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [link, setLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function create() {
    setBusy(true);
    setError(null);

    const res = await fetch("/api/place-shares", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      // Empty categories means everything, which is also what "all ticked"
      // should mean — otherwise a category invented later would be missing
      // from a link the person thought covered the lot.
      body: JSON.stringify({ area, ...covers(chosen, statuses), note: note.trim() || null }),
    });
    setBusy(false);

    if (!res.ok) {
      setError("Could not make that link");
      return;
    }
    const { share } = (await res.json()) as { share: { path: string } };
    setLink(`${window.location.origin}${share.path}`);
  }

  /// What the link would contain right now, by the rule the server applies
  /// when somebody opens it.
  const included = places.filter(
    (p) =>
      (chosen.size === 0 || chosen.size === categories.length || chosen.has(p.category)) &&
      (statuses.size === 0 || statuses.has(p.status)),
  );

  function toggle(set: Set<string>, id: string, apply: (next: Set<string>) => void) {
    const next = new Set(set);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    apply(next);
    return next;
  }

  /// What the link covers as it stands. Kept in one place so the preview and
  /// the thing that eventually gets saved cannot disagree.
  function covers(nextCategories: Set<string>, nextStatuses: Set<string>) {
    return {
      categories:
        nextCategories.size === 0 || nextCategories.size === categories.length
          ? []
          : [...nextCategories],
      statuses: [...nextStatuses],
    };
  }

  if (link) {
    return (
      <div className="card space-y-3 p-3">
        <p className="text-sm font-medium">Your {area} link is ready</p>
        <input readOnly value={link} className="input text-xs" onFocus={(e) => e.target.select()} />
        <div className="flex gap-2">
          <button
            type="button"
            className="btn btn-primary flex-1 justify-center"
            onClick={async () => {
              await navigator.clipboard.writeText(link);
              setCopied(true);
            }}
          >
            {copied ? "Copied" : "Copy link"}
          </button>
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Done
          </button>
        </div>
        <p className="text-xs text-muted">
          It stays up to date — anything you add in {area} later shows up here
          too. You can revoke it in settings.
        </p>
      </div>
    );
  }

  return (
    <div className="card space-y-3 p-3">
      <div className="flex items-start gap-2">
        <p className="min-w-0 flex-1 text-sm font-medium">Share {area}</p>
        <button type="button" className="text-xs text-muted hover:underline" onClick={onClose}>
          Cancel
        </button>
      </div>

      <div>
        <p className="mb-1.5 text-xs text-muted">What to include</p>
        <div className="flex flex-wrap gap-1.5">
          {categories.map((c) => {
            const on = chosen.size === 0 || chosen.has(c.id);
            return (
              <button
                key={c.id}
                type="button"
                className={`chip ${on ? "is-on" : ""}`}
                style={on ? { borderColor: c.color } : { opacity: 0.5 }}
                onClick={() => {
                  const next = toggle(
                    // First tap on an untouched list means "all but this one",
                    // since the list starts as everything.
                    chosen.size === 0 ? new Set(categories.map((x) => x.id)) : chosen,
                    c.id,
                    setChosen,
                  );
                  onPreview(covers(next, statuses));
                }}
              >
                <span aria-hidden>{c.icon}</span>
                {c.label}
              </button>
            );
          })}
        </div>
        {chosen.size === 0 && (
          <p className="mt-1.5 text-xs text-muted">Everything, unless you narrow it.</p>
        )}
      </div>

      <div>
        <p className="mb-1.5 text-xs text-muted">Which of your places</p>
        <div className="flex flex-wrap gap-1.5">
          {STATUSES.map((s) => (
            <button
              key={s.id}
              type="button"
              className={`chip ${statuses.has(s.id) ? "is-on" : ""}`}
              style={statuses.has(s.id) ? undefined : { opacity: 0.5 }}
              onClick={() => {
                const next = toggle(statuses, s.id, setStatuses);
                onPreview(covers(chosen, next));
              }}
            >
              <span aria-hidden>{s.icon}</span>
              {s.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="mb-1.5 text-xs text-muted">
          {included.length} {included.length === 1 ? "place" : "places"} in this link
        </p>
        {included.length === 0 ? (
          <p className="text-xs text-muted">Nothing matches what you have chosen.</p>
        ) : (
          <ul className="max-h-44 divide-y divide-line overflow-y-auto rounded-lg border border-line">
            {included.map((p) => (
              <li key={p.id} className="flex items-center gap-2 px-2.5 py-1.5">
                <span aria-hidden className="text-sm">
                  {p.emoji || categoryOf(p.category).icon}
                </span>
                <span className="min-w-0 flex-1 truncate text-sm">{placeName(p)}</span>
                <span className="shrink-0 text-xs text-muted">
                  {categoryOf(p.category).label}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <input
        className="input"
        value={note}
        maxLength={280}
        placeholder="A note, if you like — “start with the ones near the water”"
        onChange={(e) => setNote(e.target.value)}
      />

      {error && <p className="text-xs text-red-500">{error}</p>}

      <button
        type="button"
        className="btn btn-primary w-full justify-center"
        disabled={busy || statuses.size === 0}
        onClick={() => void create()}
      >
        {busy ? "Making the link…" : "Make a link"}
      </button>
    </div>
  );
}
