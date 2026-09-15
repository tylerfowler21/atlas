import { StyleSheet, Text, View } from "react-native";
import { type } from "@/lib/type";
import { usePalette } from "@/lib/use-palette";

/// A line saying what is on screen came off the phone rather than the network.
///
/// Said rather than hidden, because the difference matters: somebody reading
/// a plan on a plane should know whether it is the plan as it was this morning
/// or as it is now. A cache that pretends to be live is worse than no cache —
/// it is the same screen either way, and only one of them can be trusted to be
/// current.
///
/// Quiet about it, though. This is the normal state of a travel app abroad,
/// not an error, so it reads as a timestamp rather than a warning.

function howLongAgo(at: Date) {
  const minutes = Math.round((Date.now() - at.getTime()) / 60000);
  if (minutes < 2) return "a moment ago";
  if (minutes < 60) return `${minutes} minutes ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} ${hours === 1 ? "hour" : "hours"} ago`;
  const days = Math.round(hours / 24);
  return `${days} ${days === 1 ? "day" : "days"} ago`;
}

export default function OfflineNote({ at }: { at: Date | null }) {
  const palette = usePalette();
  if (!at) return null;

  return (
    <View style={[styles.bar, { backgroundColor: palette.brandSurface }]}>
      <Text style={[type.meta, { color: palette.ink }]}>
        Offline — showing what was here {howLongAgo(at)}.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { paddingHorizontal: 16, paddingVertical: 8 },
});
