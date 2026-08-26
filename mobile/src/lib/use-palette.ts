import { useColorScheme } from "react-native";
import { colors, type Palette } from "@/lib/theme";

/// The palette for the current appearance. A hook rather than a context because
/// React Native already tracks the system setting and re-renders on change.
export function usePalette(): Palette {
  return useColorScheme() === "dark" ? colors.dark : colors.light;
}
