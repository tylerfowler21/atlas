/// 🇵🇹 from "pt" — regional indicator symbols are just A–Z offset into a
/// separate Unicode block, so this needs no lookup table.
///
/// Its own file rather than a corner of geo.ts, because the app wants it and
/// the rest of geo.ts is about distances and bounding boxes.
export function flagEmoji(countryCode?: string | null): string {
  if (!countryCode || countryCode.length !== 2) return "🌍";
  const base = 0x1f1e6;
  const chars = [...countryCode.toUpperCase()].map((c) =>
    String.fromCodePoint(base + c.charCodeAt(0) - 65),
  );
  return chars.join("");
}
