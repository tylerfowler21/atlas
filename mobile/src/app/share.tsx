/// Where a TikTok lands when it is shared into Roava.
///
/// The share sheet cannot ask which trip — it has a few megabytes and no
/// account. So it hands the link over here, and this is the one question worth
/// asking before the importer takes over: which trip is this for.
///
/// Trips still to come are listed first, because a video you are saving is
/// almost always about somewhere you have not been yet.
import { useMemo } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useApi } from "@/lib/use-api";
import { usePalette } from "@/lib/use-palette";
import { formatDay } from "@/lib/dates";
import type { Trip } from "@/lib/api";

/// A trip has not happened yet if it has no end, or its end is still ahead.
function upcoming(trip: Trip) {
  if (!trip.endDate) return true;
  return Date.parse(trip.endDate) >= Date.now() - 86_400_000;
}

function when(trip: Trip) {
  if (!trip.startDate) return "No dates yet";
  return trip.endDate
    ? `${formatDay(trip.startDate, { year: undefined })} – ${formatDay(trip.endDate)}`
    : formatDay(trip.startDate);
}

export default function ShareScreen() {
  const { url } = useLocalSearchParams<{ url?: string }>();
  const { data, error, loading } = useApi<{ trips: Trip[] }>("/api/trips");
  const palette = usePalette();
  const router = useRouter();

  /// Soonest first among the ones still ahead, then everything else — the
  /// order you would guess at, rather than the order they were made in.
  const trips = useMemo(() => {
    const all = data?.trips ?? [];
    const rank = (t: Trip) => (upcoming(t) ? 0 : 1);
    const at = (t: Trip) => (t.startDate ? Date.parse(t.startDate) : Infinity);
    return [...all].sort((a, b) => rank(a) - rank(b) || at(a) - at(b));
  }, [data]);

  return (
    <ScrollView
      style={{ backgroundColor: palette.background }}
      contentContainerStyle={styles.page}
    >
      <Text style={[styles.title, { color: palette.ink }]}>Add to which trip?</Text>
      {url && (
        <Text style={[styles.link, { color: palette.muted }]} numberOfLines={1}>
          {url}
        </Text>
      )}

      {loading && !data && (
        <Text style={{ color: palette.muted, marginTop: 20 }}>Loading your trips…</Text>
      )}
      {error && <Text style={{ color: palette.muted, marginTop: 20 }}>{error}</Text>}
      {data && trips.length === 0 && (
        <Text style={{ color: palette.muted, marginTop: 20 }}>
          No trips yet — make one first and the link will have somewhere to go.
        </Text>
      )}

      {trips.map((trip) => (
        <Pressable
          key={trip.id}
          onPress={() =>
            router.replace({
              pathname: "/trip/[id]",
              params: { id: trip.id, ...(url ? { shareUrl: url } : {}) },
            })
          }
          style={[styles.row, { borderColor: palette.border }]}
        >
          <View style={[styles.swatch, { backgroundColor: trip.color }]} />
          <View style={{ flex: 1 }}>
            <Text style={{ color: palette.ink, fontSize: 16 }} numberOfLines={1}>
              {trip.title}
            </Text>
            <Text style={{ color: palette.muted, fontSize: 12 }} numberOfLines={1}>
              {when(trip)}
            </Text>
          </View>
        </Pressable>
      ))}

      <Pressable onPress={() => router.replace("/(tabs)/trips")} style={styles.cancel}>
        <Text style={{ color: palette.muted, fontSize: 15 }}>Not now</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { padding: 18, paddingTop: 60 },
  title: { fontSize: 22, fontWeight: "700" },
  link: { fontSize: 12, marginTop: 6 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 13,
    marginTop: 10,
  },
  swatch: { width: 10, height: 34, borderRadius: 5 },
  cancel: { alignItems: "center", paddingVertical: 22 },
});
