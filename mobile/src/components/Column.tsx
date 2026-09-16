import { useWindowDimensions, StyleSheet, View, type ViewStyle } from "react-native";
import { COLUMN } from "@/lib/wide";

/// Keeps content to a readable width and puts it in the middle.
///
/// On anything phone-shaped this renders nothing at all — not a wrapper with
/// no effect, but literally its children, so no view is added, no flex chain
/// changes, and a layout that works today cannot be broken by a width it will
/// never see. The iPad arrangement is the exception; the phone is the rule.

export default function Column({
  children,
  max = COLUMN,
  style,
}: {
  children: React.ReactNode;
  max?: number;
  style?: ViewStyle;
}) {
  const { width } = useWindowDimensions();
  if (width <= max) return <>{children}</>;

  return (
    <View style={[styles.centre, style]}>
      <View style={[styles.inner, { maxWidth: max }]}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  centre: { flex: 1, alignItems: "center" },
  inner: { flex: 1, width: "100%" },
});
