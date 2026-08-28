"use client";

import { useCategories } from "@/components/CategoriesProvider";

// taxonomy comes through the provider

export default function CategoryPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const { categories } = useCategories();
  return (
    <div className="flex flex-wrap gap-1.5">
      {categories.map((c) => (
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
