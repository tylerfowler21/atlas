import { useMemo } from "react";
import { View, type ViewStyle } from "react-native";
import Svg, { Circle } from "react-native-svg";
import { DOT_COLS, DOT_LAND, DOT_ROWS, DOT_COUNTRY_CELLS } from "@/lib/dot-world";
import { usePalette } from "@/lib/use-palette";

/// The world as a field of dots, with the countries you have been to lit.
///
/// The same picture the website draws, from the same generated table, so the
/// shape of the world cannot differ between them. There is nothing to pan and
/// no tiles to fetch — it is a picture of a fact rather than a map you use.
export default function DotWorld({
  countryCodes,
  style,
}: {
  /// ISO-3166 alpha-2, lower case.
  countryCodes: string[];
  style?: ViewStyle;
}) {
  const palette = usePalette();

  const lit = useMemo(() => {
    const cells = new Set<number>();
    for (const code of countryCodes) {
      for (const cell of DOT_COUNTRY_CELLS[code] ?? []) cells.add(cell);
    }
    return cells;
  }, [countryCodes]);

  return (
    <View style={[{ aspectRatio: DOT_COLS / DOT_ROWS }, style]}>
      {/* One unit per cell, so the viewBox does the arithmetic and the dots
          stay round at whatever width the screen gives this. */}
      <Svg width="100%" height="100%" viewBox={`0 0 ${DOT_COLS} ${DOT_ROWS}`}>
        {DOT_LAND.map((cell) => {
          const on = lit.has(cell);
          return (
            <Circle
              key={cell}
              cx={(cell % DOT_COLS) + 0.5}
              cy={Math.floor(cell / DOT_COLS) + 0.5}
              // Lit dots are larger as well as a different colour. At this
              // size colour alone is a weak signal, and no signal at all to
              // somebody who cannot separate orange from grey.
              r={on ? 0.42 : 0.32}
              fill={on ? palette.accent : palette.border}
            />
          );
        })}
      </Svg>
    </View>
  );
}
