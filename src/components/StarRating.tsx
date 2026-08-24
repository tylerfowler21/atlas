"use client";

type Props = {
  value: number | null;
  onChange?: (value: number | null) => void;
  size?: "sm" | "md";
};

export default function StarRating({ value, onChange, size = "md" }: Props) {
  const readOnly = !onChange;
  const cls = size === "sm" ? "text-xs" : "text-base";

  if (readOnly) {
    if (!value) return null;
    return (
      <span className={`${cls} tracking-tight`} aria-label={`${value} out of 5`}>
        {"★".repeat(value)}
        <span className="opacity-25">{"★".repeat(5 - value)}</span>
      </span>
    );
  }

  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          // Clicking the current rating again clears it.
          onClick={() => onChange(value === n ? null : n)}
          aria-label={`Rate ${n} out of 5`}
          className={`${cls} leading-none transition-opacity ${
            value && n <= value ? "opacity-100" : "opacity-25 hover:opacity-60"
          }`}
        >
          ★
        </button>
      ))}
    </div>
  );
}
