import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { api } from "@/lib/api";
import { type } from "@/lib/type";
import { usePalette } from "@/lib/use-palette";
import { type PublishCandidate, worthPublishing } from "@/lib/publish-prompt";

/// The offer to put a finished trip on your profile.
///
/// Publishing was a switch at the bottom of the settings sheet, under the
/// colour and the style, and two accounts in twenty-four had ever found it.
/// This asks instead — once, on the trip itself, at the point the trip is
/// over and there is something on it worth reading.
///
/// Both answers are final. Yes publishes; no is remembered, so nobody is
/// asked twice about the same trip. An offer that comes back every time you
/// open something is not an offer.

export default function PublishPrompt({
  tripId,
  trip,
  stops,
  owned,
  onChanged,
}: {
  tripId: string;
  trip: PublishCandidate;
  stops: number;
  owned: boolean;
  onChanged: () => void;
}) {
  const palette = usePalette();
  const [busy, setBusy] = useState(false);
  const [answered, setAnswered] = useState(false);

  if (answered || !worthPublishing(trip, stops, owned)) return null;

  async function answer(publish: boolean) {
    setBusy(true);
    try {
      await api(`/api/trips/${tripId}`, {
        method: "PATCH",
        body: JSON.stringify(publish ? { published: true } : { publishAsked: true }),
      });
      setAnswered(true);
      if (publish) onChanged();
    } catch {
      // Nothing worth an alert: the switch in the settings sheet is still
      // there, and a failed offer should not become an error message about a
      // trip somebody was only reading.
      setAnswered(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={[styles.card, { backgroundColor: palette.surface, borderColor: palette.border }]}>
      <Text style={[type.item, { color: palette.ink }]}>This one looks finished.</Text>
      <Text style={[type.meta, styles.line, { color: palette.muted }]}>
        Putting it on your profile lets people read the itinerary — the days and
        the stops, as you wrote them. Your journal entries stay private.
      </Text>

      <View style={styles.answers}>
        <Pressable
          disabled={busy}
          onPress={() => void answer(true)}
          style={[styles.yes, { backgroundColor: palette.primary }]}
        >
          <Text style={[type.button, { color: palette.onPrimary }]}>Put it on my profile</Text>
        </Pressable>
        <Pressable disabled={busy} onPress={() => void answer(false)} style={styles.no} hitSlop={8}>
          <Text style={[type.metaStrong, { color: palette.muted }]}>Not this one</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: 12, padding: 16, margin: 16, gap: 6 },
  line: { lineHeight: 19 },
  answers: { flexDirection: "row", alignItems: "center", gap: 14, marginTop: 10 },
  yes: { minHeight: 44, justifyContent: "center", paddingHorizontal: 18, borderRadius: 22 },
  no: { minHeight: 44, justifyContent: "center" },
});
