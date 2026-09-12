/// How much room the floating tab bar needs.
///
/// The bar is a pill over the content rather than a strip under it, which is
/// what makes the glass worth having — it has something to refract. The cost
/// is that it covers whatever is beneath it, so every screen that scrolls has
/// to leave room, and that room is written down once here rather than guessed
/// at separately in each one.
export const TAB_BAR_HEIGHT = 62;
export const TAB_BAR_MARGIN = 10;

/// The round button beside the bar, not inside it — which is where the kit
/// puts it, and why the bar stops short of the right edge.
export const FAB_SIZE = 58;
export const FAB_GAP = 10;

/// Where the bar ends on the right, leaving the button its room.
export const TAB_BAR_RIGHT = 16 + FAB_SIZE + FAB_GAP;

/// The bottom padding a scrolling screen needs. Takes the safe-area inset,
/// because the bar sits above the home indicator and so must the content.
export function tabBarSpace(bottomInset: number) {
  return TAB_BAR_HEIGHT + TAB_BAR_MARGIN * 2 + bottomInset;
}

/// The grab handle and its label, which is all of the map's sheet that shows
/// when the list is closed.
export const SHEET_HANDLE = 72;

/// How far up from the bottom of the map anything floating has to start.
///
/// The collapsed sheet is taller than the tab bar, so clearing the bar is not
/// enough — the Sun button and the locate button were being drawn underneath
/// it, which is why only a sliver of the Sun showed.
export function mapFloorSpace(bottomInset: number) {
  return SHEET_HANDLE + tabBarSpace(bottomInset);
}
