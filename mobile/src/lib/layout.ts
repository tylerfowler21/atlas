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
