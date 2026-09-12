import { Image } from "expo-image";
import { StyleSheet, Text, View } from "react-native";
import { RADIUS } from "@/lib/brand";

/// The square beside a place, wherever a place is listed.
///
/// Wikipedia's photograph when there is one, and the category's colour with
/// its emoji when there is not. The same two states as the website's, so a
/// place looks like itself in both.
///
/// The tile mixes the category colour towards white rather than using it neat:
/// an emoji on a saturated square is hard to read, and ten saturated squares
/// down a list is louder than the list.
export default function PlaceThumb({
  icon,
  color,
  photoUrl,
  size = 44,
}: {
  icon: string;
  color: string;
  photoUrl?: string | null;
  size?: number;
}) {
  const shape = { width: size, height: size, borderRadius: RADIUS.photo };

  if (photoUrl) {
    return (
      <Image
        source={{ uri: photoUrl }}
        style={shape}
        contentFit="cover"
        cachePolicy="memory-disk"
        transition={120}
      />
    );
  }

  return (
    <View style={[shape, styles.tile, { backgroundColor: mix(color, 0.18) }]}>
      <Text style={{ fontSize: size / 2 }}>{icon}</Text>
    </View>
  );
}

/// `color-mix` towards white, which React Native has no equivalent for.
/// Expects the six-digit hex the categories are written in.
function mix(hex: string, white: number) {
  const h = hex.replace("#", "");
  if (h.length !== 6) return hex;
  const to = (i: number) => {
    const v = parseInt(h.slice(i, i + 2), 16);
    return Math.round(v + (255 - v) * white);
  };
  return `rgb(${to(0)}, ${to(2)}, ${to(4)})`;
}

const styles = StyleSheet.create({
  tile: { alignItems: "center", justifyContent: "center" },
});
