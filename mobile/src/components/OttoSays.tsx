import { StyleSheet, Text, View } from "react-native";
import Otto, { type OttoPose } from "@/components/Otto";
import { OTTO_SAYS, type OttoTopic } from "@/lib/otto-says";
import { type } from "@/lib/type";
import { usePalette } from "@/lib/use-palette";

/// Otto explaining a screen that has nothing on it yet.
///
/// His quiet register: authored sentences, no model, no allowance, the same
/// words every time. Free to draw and free to read, which is the point — most
/// of a new account is empty screens, and an empty screen with nobody on it is
/// a dead end.
///
/// The same words as the website, from the same mirrored file, so he is one
/// character rather than two pieces of copy that happen to share a name.

/// Where the app has to say something different from the website, because the
/// app is shaped differently — not because somebody preferred other words.
///
/// The journal is the only one so far. On the website an entry is started from
/// a place on the map, so his second line has to send you there or the screen
/// is a dead end. In the app the button is on this screen and the place is
/// optional, so that sentence would send somebody on an errand they do not
/// need to run.
const IN_APP: Partial<Record<OttoTopic, string>> = {
  emptyJournal: "An entry can hang off a place, which is how it finds its way onto the map later — but it does not have to.",
};

export default function OttoSays({
  topic,
  pose = "planning",
}: {
  topic: OttoTopic;
  pose?: OttoPose;
}) {
  const palette = usePalette();
  const tip = OTTO_SAYS[topic];
  const then = IN_APP[topic] ?? ("then" in tip ? tip.then : undefined);

  // No link, deliberately. Every empty screen in the app already carries its
  // own button — New trip, Write something, the + on the map — and the one
  // topic whose link goes elsewhere on the website points at the tab you are
  // already standing on. A link to here is worse than no link.
  return (
    <View style={styles.wrap}>
      <Otto pose={pose} />
      <View style={styles.words}>
        <Text style={[type.body, { color: palette.ink }]}>{tip.says}</Text>
        {then && <Text style={[type.meta, { color: palette.muted }]}>{then}</Text>}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: "row", alignItems: "flex-start", gap: 12, paddingHorizontal: 16, paddingVertical: 20 },
  words: { flex: 1, paddingTop: 4, gap: 6 },
});
