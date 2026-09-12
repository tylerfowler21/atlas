import { StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { type } from "@/lib/type";
import { usePalette } from "@/lib/use-palette";

/// A tab's name, drawn by the screen rather than by the navigator.
///
/// The map is full-bleed under the status bar — a title bar over it is a strip
/// of paint where the map should be — so the tabs no longer have a navigator
/// header at all. The screens that do want a heading get it in the kit's
/// display face, which the system header cannot be given, and at the size the
/// boards draw it.
export default function ScreenTitle({ children }: { children: string }) {
  const palette = usePalette();
  const insets = useSafeAreaInsets();

  return (
    <View style={{ paddingTop: insets.top + 8 }}>
      <Text style={[type.title, styles.title, { color: palette.ink }]}>{children}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  title: { paddingHorizontal: 16, paddingBottom: 8 },
});
