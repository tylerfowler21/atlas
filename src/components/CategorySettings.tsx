"use client";

import { useState } from "react";
import { useCategories } from "@/components/CategoriesProvider";
import EmojiField from "@/components/EmojiField";
import { BUILT_IN_CATEGORIES, type Category } from "@/lib/taxonomy";

/// Making your own categories.
///
/// The ten built-in ones stay: they are what the geocoder's guesses land on,
/// and they are what a place falls back to. These sit alongside them, so
/// somebody who wants "Dive sites" or "Grandma's" gets it without anyone having
/// to agree that those belong in everybody's app.

const DEFAULT_COLOR = "#14B8A6";

export default function CategorySettings() {
  const { categories, setCustom } = useCategories();
  const custom = categories.filter((c) => c.custom);

  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function create(draft: { label: string; icon: string; color: string }) {
    setBusy(true);
    setError(null);
    const res = await fetch("/api/categories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(draft),
    });
    setBusy(false);
    if (!res.ok) {
      setError(((await res.json()) as { error?: string }).error ?? "Could not save that");
      return;
    }
    const { category } = (await res.json()) as { category: Category };
    setCustom([...custom, category]);
    setAdding(false);
  }

  async function update(id: string, patch: Partial<Category>) {
    const res = await fetch(`/api/categories/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    if (!res.ok) {
      setError(((await res.json()) as { error?: string }).error ?? "Could not save that");
      return;
    }
    setCustom(custom.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  }

  async function remove(c: Category) {
    if (
      !window.confirm(
        `Delete "${c.label}"?\n\nAnything filed under it moves to Other. No places are deleted.`,
      )
    ) {
      return;
    }
    const res = await fetch(`/api/categories/${c.id}`, { method: "DELETE" });
    if (!res.ok) {
      setError("Could not delete that category");
      return;
    }
    const { movedPlaces } = (await res.json()) as { movedPlaces: number };
    setCustom(custom.filter((x) => x.id !== c.id));
    if (movedPlaces > 0) {
      setError(
        `"${c.label}" deleted. ${movedPlaces} ${movedPlaces === 1 ? "place" : "places"} moved to Other.`,
      );
    }
  }

  return (
    <div>
      <h2 className="text-sm font-semibold">Categories</h2>
      <p className="mt-1 text-xs text-muted">
        Your own, alongside the built-in ones. They set the colour of a pin and
        the emoji it uses, and you can file places and stops under them
        everywhere — on the website and in the app.
      </p>

      <ul className="mt-3 space-y-2">
        {custom.map((c) => (
          <CategoryRow key={c.id} category={c} onSave={update} onDelete={remove} />
        ))}
      </ul>

      {custom.length === 0 && !adding && (
        <p className="mt-3 text-xs text-muted">
          You haven&apos;t made any yet.
        </p>
      )}

      {adding ? (
        <div className="card mt-3 p-3">
          <CategoryFields
            initial={{ label: "", icon: "📌", color: DEFAULT_COLOR }}
            busy={busy}
            submitLabel="Add category"
            onSubmit={create}
            onCancel={() => setAdding(false)}
          />
        </div>
      ) : (
        <button type="button" className="btn btn-ghost mt-3" onClick={() => setAdding(true)}>
          New category
        </button>
      )}

      {error && <p className="mt-2 text-xs text-muted">{error}</p>}

      <details className="mt-5">
        <summary className="cursor-pointer text-xs text-muted">
          The built-in categories
        </summary>
        <p className="mt-2 text-xs text-muted">
          These can&apos;t be changed — they&apos;re what a searched place gets
          guessed into, and where anything falls back to.
        </p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {BUILT_IN_CATEGORIES.map((c) => (
            <span key={c.id} className="chip" style={{ borderColor: c.color }}>
              <span aria-hidden>{c.icon}</span>
              {c.label}
            </span>
          ))}
        </div>
      </details>
    </div>
  );
}

function CategoryRow({
  category,
  onSave,
  onDelete,
}: {
  category: Category;
  onSave: (id: string, patch: Partial<Category>) => Promise<void>;
  onDelete: (category: Category) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);

  if (editing) {
    return (
      <li className="card p-3">
        <CategoryFields
          initial={category}
          busy={false}
          submitLabel="Save"
          onSubmit={async (draft) => {
            await onSave(category.id, draft);
            setEditing(false);
          }}
          onCancel={() => setEditing(false)}
        />
      </li>
    );
  }

  return (
    <li className="flex items-center gap-3 rounded-lg border border-line px-3 py-2">
      <span
        aria-hidden
        className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-sm"
        style={{ backgroundColor: `${category.color}22`, border: `2px solid ${category.color}` }}
      >
        {category.icon}
      </span>
      <span className="min-w-0 flex-1 truncate text-sm">{category.label}</span>
      <button type="button" className="btn btn-ghost text-xs" onClick={() => setEditing(true)}>
        Edit
      </button>
      <button
        type="button"
        className="btn btn-ghost text-xs"
        onClick={() => void onDelete(category)}
      >
        Delete
      </button>
    </li>
  );
}

function CategoryFields({
  initial,
  busy,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  initial: { label: string; icon: string; color: string };
  busy: boolean;
  submitLabel: string;
  onSubmit: (draft: { label: string; icon: string; color: string }) => Promise<void>;
  onCancel: () => void;
}) {
  const [label, setLabel] = useState(initial.label);
  const [icon, setIcon] = useState(initial.icon);
  const [color, setColor] = useState(initial.color);

  const ready = label.trim().length > 0 && icon.trim().length > 0;

  return (
    <div className="space-y-3">
      <input
        className="input"
        value={label}
        maxLength={30}
        placeholder="Dive sites"
        aria-label="Category name"
        onChange={(e) => setLabel(e.target.value)}
      />

      <EmojiField
        emoji={icon}
        category="other"
        fallback="📌"
        onChange={(next) => setIcon(next ?? "📌")}
      />

      <label className="flex items-center gap-2 text-xs text-muted">
        Pin colour
        <input
          type="color"
          value={color}
          className="h-7 w-12 cursor-pointer rounded border border-line bg-transparent"
          onChange={(e) => setColor(e.target.value)}
        />
      </label>

      <div className="flex gap-2">
        <button
          type="button"
          className="btn btn-primary"
          disabled={!ready || busy}
          onClick={() => void onSubmit({ label: label.trim(), icon, color })}
        >
          {submitLabel}
        </button>
        <button type="button" className="btn btn-ghost" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </div>
  );
}
