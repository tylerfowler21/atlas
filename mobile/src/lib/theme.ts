/// The brand guide's colour system, mirroring the website's tokens.
///
/// Same roles, same hexes: Deep Ocean for navigation, Coastal Teal for calls to
/// action, Sea Glass for highlights, Warm Cream as the brand surface, Soft
/// White as the page, Ink for body text.
///
/// White on Coastal Teal is 2.5:1, so anything drawn on the teal uses Ink —
/// the same reason the website carries a separate token for it.
export const colors = {
  light: {
    background: "#FCFAF6",
    surface: "#FFFFFF",
    brandSurface: "#F4EDE1",
    ink: "#14212B",
    muted: "#55677A",
    border: "rgba(20, 33, 43, 0.12)",
    accent: "#14B8A6",
    onAccent: "#14212B",
    /// Deep Ocean. Teal is unreadable as text at 2.5:1, so anything that wants
    /// to look active and is text uses this instead.
    accentText: "#0F2D4A",
    seaGlass: "#A7F3E0",
  },
  dark: {
    background: "#0B1620",
    surface: "#14212B",
    brandSurface: "#0F2D4A",
    ink: "#FCFAF6",
    muted: "#9FB3C4",
    border: "rgba(167, 243, 224, 0.14)",
    accent: "#14B8A6",
    onAccent: "#0B1620",
    accentText: "#A7F3E0",
    seaGlass: "#A7F3E0",
  },
} as const;

/// Widened to plain strings on purpose: `as const` gives each palette its own
/// literal types, which makes the dark one un-assignable to the light one and
/// stops either being used interchangeably.
export type Palette = Record<keyof (typeof colors)["light"], string>;

/// Trip colours, matching the website's picker so a trip is the same colour in
/// both places.
export const TRIP_COLORS = [
  "#0F2D4A",
  "#14B8A6",
  "#4A6B8A",
  "#E07A5F",
  "#D9A441",
  "#7A946B",
] as const;
