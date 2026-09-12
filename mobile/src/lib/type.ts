import {
  BricolageGrotesque_700Bold,
  BricolageGrotesque_800ExtraBold,
} from "@expo-google-fonts/bricolage-grotesque";
import {
  Geist_400Regular,
  Geist_500Medium,
  Geist_600SemiBold,
} from "@expo-google-fonts/geist";
import type { TextStyle } from "react-native";

/// The five faces the kit actually uses, and the type scale built from them.
///
/// Loaded rather than bundled by hand: these packages carry the TTFs and the
/// licence, and the name a face is registered under is its export name, which
/// is why the strings below repeat it.
export const FONTS = {
  BricolageGrotesque_700Bold,
  BricolageGrotesque_800ExtraBold,
  Geist_400Regular,
  Geist_500Medium,
  Geist_600SemiBold,
};

/// React Native has no font synthesis worth the name: asking for weight 800 on
/// a family that only registered its regular gives you the regular, silently.
/// So weight is chosen by picking a different family, and `fontWeight` is
/// deliberately absent from everything here.
const DISPLAY = "BricolageGrotesque_800ExtraBold";
const DISPLAY_BOLD = "BricolageGrotesque_700Bold";
const UI = "Geist_400Regular";
const UI_MEDIUM = "Geist_500Medium";
const UI_SEMIBOLD = "Geist_600SemiBold";

/// The kit's scale. Sizes are the smaller end of each range, which is what a
/// phone gets; the wider end is for the desktop web.
export const type = {
  /// A trip's name, a screen's name.
  title: { fontFamily: DISPLAY, fontSize: 30, lineHeight: 34, letterSpacing: -0.6 },
  /// "Day 2, Fushimi to Gion".
  section: { fontFamily: DISPLAY_BOLD, fontSize: 22, lineHeight: 26, letterSpacing: -0.3 },
  /// The name of one place in a list.
  item: { fontFamily: UI_SEMIBOLD, fontSize: 16, lineHeight: 21 },
  body: { fontFamily: UI, fontSize: 15, lineHeight: 23 },
  /// Category, city, times — everything secondary.
  meta: { fontFamily: UI, fontSize: 13, lineHeight: 18 },
  /// The same size as meta but carrying weight, for a label rather than a
  /// remark.
  metaStrong: { fontFamily: UI_MEDIUM, fontSize: 13, lineHeight: 18 },
  /// Buttons.
  button: { fontFamily: UI_SEMIBOLD, fontSize: 15, lineHeight: 20 },
} satisfies Record<string, TextStyle>;
