"use client";

import { useMemo, useState } from "react";
import { category as categoryOf } from "@/lib/taxonomy";
import { searchEmoji } from "@/lib/emoji-search";

/// Travel-shaped quick picks. Typing or pasting anything else works too — on a
/// Mac the system picker is ctrl+cmd+space — so this is a shortcut, not a limit.
const SUGGESTIONS = [
  "🥐", "🍜", "🍕", "🍣", "🧀", "🍦", "🍺", "🍷",
  "🏔️", "🏖️", "🌋", "🚡", "🚂", "⛪", "🏰", "🎨",
];

export default function EmojiField({
  emoji,
  category,
  fallback: explicitFallback,
  onChange,
}: {
  emoji: string | null;
  category: string;
  /// What shows when there is no emoji here. For a trip stop that may be the
  /// place's own emoji rather than the category's.
  fallback?: string;
  onChange: (emoji: string | null) => void;
}) {
  const fallback = explicitFallback ?? categoryOf(category).icon;
  const [query, setQuery] = useState("");

  // Searching is local, so results appear as you type with no network call —
  // unlike place search, which has a geocoder's rate limit to respect.
  const hits = useMemo(() => searchEmoji(query), [query]);
  const searching = query.trim().length > 0;

  return (
    <div>
      <p className="mb-1.5 text-xs text-muted">
        Pin emoji{" "}
        {emoji ? (
          <button
            type="button"
            className="text-accent-text hover:underline"
            onClick={() => onChange(null)}
          >
            — reset to {fallback}
          </button>
        ) : (
          <span>— using the category&apos;s {fallback}</span>
        )}
      </p>

      <div className="flex items-center gap-2">
        <span
          aria-hidden
          className="grid size-9 shrink-0 place-items-center rounded-full border border-line text-lg"
        >
          {emoji || fallback}
        </span>
        <input
          className="input w-24 text-center text-lg"
          aria-label="Pin emoji"
          value={emoji ?? ""}
          placeholder={fallback}
          onChange={(e) => onChange(e.target.value.trim() || null)}
        />
      </div>

      <input
        className="input mt-2 text-xs"
        aria-label="Search emoji"
        placeholder="Search — waterfall, cheese, castle, hike…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />

      {searching && hits.length === 0 ? (
        <p className="mt-2 text-xs text-muted">
          Nothing for “{query.trim()}”. Any emoji works in the box above —
          ctrl+cmd+space opens the system picker.
        </p>
      ) : (
        <div className="mt-2 flex flex-wrap gap-1">
          {(searching ? hits.map((h) => h.emoji) : SUGGESTIONS).map((s, i) => (
            <button
              key={`${s}-${i}`}
              type="button"
              aria-label={`Use ${s}`}
              title={searching ? hits[i]?.keyword : undefined}
              className={`grid size-8 place-items-center rounded-md border text-base hover:bg-foreground/5 ${
                emoji === s ? "border-accent bg-accent/10" : "border-line"
              }`}
              onClick={() => {
                onChange(s);
                setQuery("");
              }}
            >
              {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
