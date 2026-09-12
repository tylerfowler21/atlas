import { DOT_COLS, DOT_LAND, DOT_ROWS, DOT_COUNTRY_CELLS } from "@/lib/dot-world";

/// The world as a field of dots, with the countries you have been to lit.
///
/// An SVG of circles rather than a map: there is nothing to pan, nothing to
/// load, and no tile server to pay — the whole thing is a few hundred dots
/// from a table generated at build time, which the app draws from too. It is a
/// picture of a fact rather than a map you use.
export default function DotWorld({
  countryCodes,
  className,
}: {
  /// ISO-3166 alpha-2, lower case.
  countryCodes: string[];
  className?: string;
}) {
  const lit = new Set<number>();
  for (const code of countryCodes) {
    for (const cell of DOT_COUNTRY_CELLS[code] ?? []) lit.add(cell);
  }

  // One unit per cell, so the viewBox does the arithmetic and the dots stay
  // round at any width.
  return (
    <svg
      viewBox={`0 0 ${DOT_COLS} ${DOT_ROWS}`}
      className={className}
      role="img"
      aria-label={
        countryCodes.length > 0
          ? `A world map with ${countryCodes.length} countries marked`
          : "A world map with nothing marked yet"
      }
      preserveAspectRatio="xMidYMid meet"
    >
      {DOT_LAND.map((cell) => {
        const on = lit.has(cell);
        return (
          <circle
            key={cell}
            cx={(cell % DOT_COLS) + 0.5}
            cy={Math.floor(cell / DOT_COLS) + 0.5}
            // Lit dots are drawn a little larger as well as a different
            // colour. On a map this size colour alone is a weak signal, and
            // it is no signal at all to somebody who cannot separate orange
            // from grey.
            r={on ? 0.42 : 0.32}
            fill={on ? "var(--accent)" : "var(--border)"}
          />
        );
      })}
    </svg>
  );
}
