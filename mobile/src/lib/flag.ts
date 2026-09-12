/// Mirrored from the website's src/lib/flag.ts — edit that copy and run
/// `npm run sync:mirror`.
export function flagEmoji(countryCode?: string | null): string {
  if (!countryCode || countryCode.length !== 2) return "🌍";
  const base = 0x1f1e6;
  const chars = [...countryCode.toUpperCase()].map((c) =>
    String.fromCodePoint(base + c.charCodeAt(0) - 65),
  );
  return chars.join("");
}
