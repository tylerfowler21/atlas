import { Text } from "react-native";
import { PAINT } from "@/lib/brand";
import { usePalette } from "@/lib/use-palette";

/// A place's own rating, out of five.
///
/// One Text rather than five, and labelled with the number: a screen reader
/// working through "star star star star star" has told you nothing about how
/// many are filled.
export default function Stars({ value, size = 13 }: { value: number; size?: number }) {
  const palette = usePalette();
  return (
    <Text
      accessibilityLabel={`Rated ${value} out of 5`}
      style={{ fontSize: size, letterSpacing: 1 }}
    >
      <Text style={{ color: PAINT.sun }}>{"★".repeat(value)}</Text>
      <Text style={{ color: palette.border }}>{"★".repeat(5 - value)}</Text>
    </Text>
  );
}
