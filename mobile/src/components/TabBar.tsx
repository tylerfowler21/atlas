// expo-router bundles its own copy of the bottom-tabs navigator and
// re-exports its types here; @react-navigation/bottom-tabs is not a
// dependency of this app and importing from it resolves to nothing.
import type { BottomTabBarProps } from "expo-router/js-tabs";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Glass from "@/components/Glass";
import { TAB_BAR_HEIGHT, TAB_BAR_MARGIN, TAB_BAR_RIGHT } from "@/lib/layout";
import { type } from "@/lib/type";
import { usePalette } from "@/lib/use-palette";

/// The kit's floating bar, drawn rather than configured.
///
/// React Navigation's own bar can be restyled but not reshaped: it insists on
/// spanning the width, so `right` was quietly ignored and the Sun button had
/// nowhere to sit beside it. Drawing it here is less code than fighting that,
/// and the active pill behind the focused tab is not something the built-in
/// bar offers at all.
export default function TabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const palette = usePalette();
  const insets = useSafeAreaInsets();

  /// The bar stops short of the right edge only where something stands there.
  /// The Sun button asks what is at the middle of the map, so it belongs to
  /// the map and nowhere else; on the other tabs the bar has the full width.
  const mapFocused = state.routes[state.index]?.name === "index";

  return (
    <View
      pointerEvents="box-none"
      style={[
        styles.bar,
        {
          bottom: insets.bottom + TAB_BAR_MARGIN,
          right: mapFocused ? TAB_BAR_RIGHT : 16,
        },
      ]}
    >
      <Glass radius={TAB_BAR_HEIGHT / 2} style={StyleSheet.absoluteFill} />

      {state.routes.map((route, index) => {
        const { options } = descriptors[route.key];
        const label = options.title ?? route.name;
        const focused = state.index === index;
        const color = focused ? palette.accentText : palette.muted;

        return (
          <Pressable
            key={route.key}
            accessibilityRole="button"
            accessibilityState={focused ? { selected: true } : {}}
            accessibilityLabel={options.tabBarAccessibilityLabel ?? label}
            onPress={() => {
              const event = navigation.emit({
                type: "tabPress",
                target: route.key,
                canPreventDefault: true,
              });
              if (!focused && !event.defaultPrevented) {
                navigation.navigate(route.name, route.params);
              }
            }}
            style={styles.tab}
          >
            {/* The pill behind the focused tab, which is what tells you where
                you are once the icons are all the same weight. */}
            <View
              style={[
                styles.pill,
                focused && { backgroundColor: palette.brandSurface },
              ]}
            >
              {options.tabBarIcon?.({ focused, color, size: 24 })}
              <Text
                maxFontSizeMultiplier={1.3}
                style={[type.meta, styles.label, { color }]}
                numberOfLines={1}
              >
                {label}
              </Text>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    position: "absolute",
    left: 16,
    height: TAB_BAR_HEIGHT,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 6,
    borderRadius: TAB_BAR_HEIGHT / 2,
  },
  tab: { flex: 1, height: "100%", justifyContent: "center" },
  pill: {
    flex: 1,
    marginVertical: 6,
    borderRadius: (TAB_BAR_HEIGHT - 12) / 2,
    alignItems: "center",
    justifyContent: "center",
    gap: 1,
  },
  label: { fontSize: 11, lineHeight: 14 },
});
