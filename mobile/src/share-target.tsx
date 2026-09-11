/// What appears when somebody shares a TikTok into Roava.
///
/// This runs inside the share sheet rather than in the app: its own process, a
/// tight memory budget, and no router. So it does as little as possible —
/// reads the shared link, and hands it to the app, which has the trip list,
/// the day picker and the place lookup already.
import { close, openHostApp, Text, View, type InitialProps } from "expo-share-extension";
import { Pressable, StyleSheet } from "react-native";
import { usePalette } from "@/lib/use-palette";

export default function ShareTarget({ url, text }: InitialProps) {
  const palette = usePalette();
  // TikTok shares a URL; some apps put it in the text instead, so both are
  // looked at rather than assuming.
  const shared = url ?? text?.match(/https?:\/\/\S+/)?.[0] ?? null;

  return (
    <View style={[styles.sheet, { backgroundColor: palette.background }]}>
      <Text style={[styles.title, { color: palette.ink }]}>Add to a trip</Text>
      {shared ? (
        <>
          <Text style={[styles.body, { color: palette.muted }]} numberOfLines={2}>
            {shared}
          </Text>
          <Pressable
            style={[styles.primary, { backgroundColor: palette.primary }]}
            onPress={() => openHostApp(`/share?url=${encodeURIComponent(shared)}`)}
          >
            <Text style={[styles.primaryText, { color: palette.onPrimary }]}>Choose a trip</Text>
          </Pressable>
        </>
      ) : (
        <Text style={[styles.body, { color: palette.muted }]}>
          Nothing shareable in that — Roava takes a link to a video.
        </Text>
      )}
      <Pressable onPress={close} style={styles.cancel}>
        <Text style={[styles.cancelText, { color: palette.muted }]}>Cancel</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  sheet: { flex: 1, padding: 20, gap: 12, justifyContent: "center" },
  title: { fontSize: 18, fontWeight: "700" },
  body: { fontSize: 13 },
  primary: {
    borderRadius: 10,
    paddingVertical: 13,
    alignItems: "center",
  },
  primaryText: { fontWeight: "600", fontSize: 15 },
  cancel: { alignItems: "center", paddingVertical: 10 },
  cancelText: { fontSize: 14 },
});
