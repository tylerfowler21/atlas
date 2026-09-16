import { useWindowDimensions } from "react-native";

/// What to do with a screen that is wider than a phone.
///
/// Measured off the window rather than the device, deliberately. An iPad in
/// Split View hands the app a third of its screen, which is a phone-shaped
/// column on a tablet-shaped machine — and a layout that asks "is this an
/// iPad" gets that exactly wrong. Asking "how much room is there" is right in
/// both places, and stays right for whatever Apple ships next.

/// A column of text or cards stops being readable long before it stops being
/// wide. Trip names three inches from their dates are not a feature of the
/// large screen; they are what happens when nobody decides what to do with it.
export const COLUMN = 560;

/// Wide enough that one centred column is no longer the whole answer — the
/// point where a map could hold a list beside it rather than under it. An iPad
/// mini in portrait is 744pt, so this catches the smallest of them; a phone in
/// landscape (932pt on the largest) is deliberately over the line too, because
/// at that width the same arrangement is the better one.
export const WIDE = 700;

export function useWide() {
  const { width } = useWindowDimensions();
  return width >= WIDE;
}

/// The list's width when it stands beside the map rather than over it.
///
/// Wide enough for a place's name, its city and a photograph without the name
/// wrapping; narrow enough that the map — the thing you came to look at —
/// keeps the larger half of an iPad.
export const PANEL = 380;
