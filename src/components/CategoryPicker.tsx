"use client";

import { CATEGORIES } from "@/lib/taxonomy";

export default function CategoryPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {CATEGORIES.map((c) => (
        <button
          key={c.id}
          type="button"
          onClick={() => onChange(c.id)}
          aria-pressed={value === c.id}
          className={`chip ${value === c.id ? "is-on" : ""}`}
          style={value === c.id ? { borderColor: c.color } : undefined}
        >
          <span aria-hidden>{c.icon}</span>
          {c.label}
        </button>
      ))}
    </div>
  );
}
