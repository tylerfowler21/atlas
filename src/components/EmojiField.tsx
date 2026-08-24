"use client";

import { category as categoryOf } from "@/lib/taxonomy";

/// Travel-shaped quick picks. Typing or pasting anything else works too — on a
/// Mac the system picker is ctrl+cmd+space — so this is a shortcut, not a limit.
const SUGGESTIONS = [
  "🥐", "🍜", "🍕", "🍣", "🧀", "🍦", "🍺", "🍷",
  "🏔️", "🏖️", "🌋", "🚡", "🚂", "⛪", "🏰", "🎨",
];

export default function EmojiField({
  emoji,
  category,
  onChange,
}: {
  emoji: string | null;
  category: string;
  onChange: (emoji: string | null) => void;
}) {
  const fallback = categoryOf(category).icon;

  return (
    <div>
      <p className="mb-1.5 text-xs text-muted">
        Pin emoji{" "}
        {emoji ? (
          <button
            type="button"
            className="text-accent hover:underline"
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

      <div className="mt-2 flex flex-wrap gap-1">
        {SUGGESTIONS.map((s) => (
          <button
            key={s}
            type="button"
            aria-label={`Use ${s}`}
            className={`grid size-8 place-items-center rounded-md border text-base hover:bg-foreground/5 ${
              emoji === s ? "border-accent bg-accent/10" : "border-line"
            }`}
            onClick={() => onChange(s)}
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}
