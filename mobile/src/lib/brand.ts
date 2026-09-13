/// The brand kit's values, mirrored from the website so a colour cannot mean
/// one thing on the phone and another on the web. Edit `src/lib/brand.ts` and
/// run `npm run sync:mirror`; `npm run check:mirror` fails if they drift.
export const PAINT = {
  evergreen900: "#12322B",
  evergreen700: "#245247",
  evergreen100: "#E4EDE8",
  mist: "#F3F5F1",
  card: "#FEFEFC",
  sun: "#F98746",
  sunInk: "#A64A15",
  sunTint: "#FFE9DB",
  ink: "#13241F",
  muted: "#5B6B65",
  /// Two darks the screen boards use behind photographs and in dark surfaces.
  /// Not on the swatch grid, but drawn from the same family.
  evergreen950: "#0B211C",
  mutedOnDark: "#8A9991",
} as const;

/// What each colour is for.
///
/// `primary` and `accent` are deliberately two things. The old palette had one
/// accent doing both jobs, which worked only because teal was equally wrong for
/// both: 2.5:1 meant buttons needed dark text and links needed a different
/// colour entirely. Evergreen carries white at 13.7:1 and Sun carries Ink at
/// 6.6:1, so each does one job properly.
///
/// Sun is never text on a page — 2.4:1. Text that wants to look active uses
/// `accentText`, which is Sun ink in light and Sun itself against dark.
export const colors = {
  light: {
    background: PAINT.mist,
    surface: PAINT.card,
    brandSurface: PAINT.evergreen100,
    ink: PAINT.ink,
    muted: PAINT.muted,
    border: "rgba(19, 36, 31, 0.12)",
    /// Buttons, selected chips, navigation.
    primary: PAINT.evergreen900,
    onPrimary: PAINT.card,
    /// The floating button, counts, the things meant to catch an eye.
    accent: PAINT.sun,
    onAccent: PAINT.ink,
    accentText: PAINT.sunInk,
    accentTint: PAINT.sunTint,
  },
  dark: {
    background: PAINT.evergreen950,
    surface: PAINT.evergreen900,
    brandSurface: PAINT.evergreen700,
    ink: PAINT.mist,
    muted: PAINT.mutedOnDark,
    border: "rgba(228, 237, 232, 0.14)",
    /// Inverted: an evergreen button on an evergreen page is a rectangle you
    /// cannot see. The pale end of the same family carries the dark text.
    primary: PAINT.evergreen100,
    onPrimary: PAINT.evergreen900,
    accent: PAINT.sun,
    onAccent: PAINT.ink,
    /// Sun ink is 1.8:1 on this background. Sun itself is 6.9:1.
    accentText: PAINT.sun,
    accentTint: PAINT.evergreen700,
  },
} as const;

/// Widened to plain strings on purpose: `as const` gives each palette its own
/// literal types, which makes the dark one un-assignable to the light one and
/// stops either being used interchangeably.
export type Palette = Record<keyof (typeof colors)["light"], string>;

/// Trip colours, which a person picks from when naming a trip. Written once
/// here rather than in the website's picker, the app's picker and the app's
/// theme — three copies that had already drifted from each other.
///
/// Drawn from the pin hues rather than from the greens. A trip's colour is a
/// bar against a card, and the card is Card in light and Evergreen 900 in dark
/// — so Evergreen 900 as a trip colour is a bar you cannot see at night. These
/// six are mid-toned enough to read on both, and far enough apart in hue to
/// tell one trip from another at a glance.
///
/// Typed as plain strings rather than `as const`: these are a list to choose
/// from, not a vocabulary of roles, and literal types only make
/// `useState(TRIP_COLORS[0])` infer a state that can hold one colour.
export const TRIP_COLORS: readonly string[] = [
  "#3C7FB0",
  "#3E8E5E",
  // A shade deeper than Sun and a shade lighter than the kit's purple: both
  // clear 3:1 against Card and against Evergreen 900, which the originals did
  // not. Beside the pins they read as the same two colours.
  "#F76715",
  "#D65A4A",
  "#9465A7",
  "#B8831F",
  // Oceania's, from the region palette — so every colour a trip can be given
  // by where it goes is also one somebody can pick by hand.
  "#2F8C8C",
];

/// Two roles the kit does not name.
///
/// Nothing on the boards is overdue, failed or wrong, so there is no swatch
/// for it. These are drawn from the pin palette, which is the same family, so
/// a warning does not arrive from outside the brand — but they are a
/// stand-in, and worth a designer's eye before anyone leans on them.
export const SEMANTIC = {
  danger: "#D65A4A",
  warning: PAINT.sunInk,
} as const;

/// The ring around a saved place, by what it means to the person who saved it.
/// Evergreen for somewhere they have been, Sun for somewhere they want to go —
/// the same two colours the map's own filter chips use.
export const STATUS = {
  visited: PAINT.evergreen700,
  lived: PAINT.sunInk,
  wishlist: PAINT.sun,
} as const;

/// Corner radii, from the kit's radius rule: controls are full pills, cards and
/// sheets 24 to 28, photos inside cards 14.
export const RADIUS = {
  pill: 999,
  sheet: 28,
  card: 24,
  photo: 14,
  /// Inputs and small controls, which the rule does not name but which read as
  /// pills at a smaller size.
  control: 12,
} as const;
