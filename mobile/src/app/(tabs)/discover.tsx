import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import FeedList from "@/components/FeedList";
import PeopleList from "@/components/PeopleList";
import { usePalette } from "@/lib/use-palette";

/// Two views of the same subject: other travellers, and what they have
/// published. They were separate tabs, but People exists mostly to fill the
/// Feed — following someone is the thing that makes the Feed have anything in
/// it — so they belong on one screen with a switch.
type Segment = "feed" | "people";

export default function DiscoverScreen() {
  const palette = usePalette();
  const [segment, setSegment] = useState<Segment>("feed");

  return (
    <View style={[styles.fill, { backgroundColor: palette.background }]}>
      <View style={[styles.segments, { backgroundColor: palette.surface, borderColor: palette.border }]}>
        {(
          [
            ["feed", "Feed"],
            ["people", "People"],
          ] as const
        ).map(([id, label]) => {
          const on = segment === id;
          return (
            <Pressable
              key={id}
              onPress={() => setSegment(id)}
              style={[styles.segment, on && { backgroundColor: palette.accent }]}
            >
              <Text
                style={{
                  fontSize: 14,
                  fontWeight: on ? "600" : "400",
                  color: on ? palette.onAccent : palette.muted,
                }}
              >
                {label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* Both stay mounted so switching back does not refetch and lose your
          place in a list you were part way down. */}
      <View style={[styles.pane, segment !== "feed" && styles.hidden]}>
        <FeedList />
      </View>
      <View style={[styles.pane, segment !== "people" && styles.hidden]}>
        <PeopleList />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  segments: {
    flexDirection: "row",
    margin: 12,
    borderWidth: 1,
    borderRadius: 10,
    overflow: "hidden",
  },
  segment: { flex: 1, alignItems: "center", paddingVertical: 9 },
  pane: { flex: 1 },
  hidden: { display: "none" },
});
