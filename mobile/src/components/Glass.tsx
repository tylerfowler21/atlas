import { GlassView, isLiquidGlassAvailable } from "expo-glass-effect";
import { Platform, StyleSheet, View, type ViewProps, type ViewStyle } from "react-native";
import { usePalette } from "@/lib/use-palette";

/// Anything floating over the map: the search field, the filter chips, the
/// locate button, the tab bar.
///
/// Real Liquid Glass where the system has it, and a plain translucent surface
/// where it does not — which is anything before iOS 26, and Android. The
/// fallback is deliberately not a blur: a blurred backdrop over a live map view
/// costs a frame-by-frame recapture of what is underneath, and on the phones
/// that lack the real thing it is exactly the wrong place to spend it. An
/// opaque-enough fill reads much the same over cartography.
///
/// Checked once at module load rather than per render: it cannot change while
/// the app is running, and it is a native call.
const LIQUID = Platform.OS === "ios" && isLiquidGlassAvailable();

export default function Glass({
  style,
  children,
  radius,
  ...rest
}: ViewProps & {
  /// Corner radius. Glass has to be told its own shape — it clips its effect
  /// to the view's corners rather than inheriting them from a parent.
  radius?: number;
}) {
  const palette = usePalette();
  const shape: ViewStyle = radius === undefined ? {} : { borderRadius: radius };

  if (LIQUID) {
    return (
      <GlassView glassEffectStyle="regular" style={[shape, style]} {...rest}>
        {children}
      </GlassView>
    );
  }

  return (
    <View
      style={[
        shape,
        {
          backgroundColor: palette.surface,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: palette.border,
        },
        styles.lifted,
        style,
      ]}
      {...rest}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  /// The kit's glass shadow, which the real effect draws for itself.
  lifted: {
    shadowColor: "#12322B",
    shadowOpacity: 0.12,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
});
