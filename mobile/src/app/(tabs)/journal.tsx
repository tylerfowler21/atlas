import { useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import type { Memory, Place, Trip } from "@/lib/api";
import MemoryEditor from "@/components/MemoryEditor";
import { formatDay } from "@/lib/dates";
import { useApi } from "@/lib/use-api";
import { usePalette } from "@/lib/use-palette";

/// When it happened, which is rarely when it was written — so the date shown
/// is the one the writer chose, falling back to when it was saved.
function when(memory: Memory) {
  // happenedOn is a day and formats in UTC; createdAt is a real moment and
  // should read in the reader's own timezone.
  if (memory.happenedOn) return formatDay(memory.happenedOn);
  return new Date(memory.createdAt).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default function JournalScreen() {
  const { data, error, loading, reload } = useApi<{ memories: Memory[] }>("/api/memories");
  const { data: placeData } = useApi<{ places: Place[] }>("/api/places");
  const { data: tripData } = useApi<{ trips: Trip[] }>("/api/trips");
  const palette = usePalette();
  const [editing, setEditing] = useState<Memory | null>(null);
  const [writing, setWriting] = useState(false);

  if (loading && !data) {
    return (
      <View style={[styles.centre, { backgroundColor: palette.background }]}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <View style={[styles.fill, { backgroundColor: palette.background }]}>
      <MemoryEditor
        memory={editing}
        open={writing || editing !== null}
        places={placeData?.places ?? []}
        trips={tripData?.trips ?? []}
        onClose={() => {
          setWriting(false);
          setEditing(null);
        }}
        onSaved={reload}
      />

      <Pressable
        onPress={() => setWriting(true)}
        style={[styles.new, { backgroundColor: palette.accent }]}
      >
        <Text style={{ color: palette.onAccent, fontWeight: "600", fontSize: 15 }}>
          + Write something
        </Text>
      </Pressable>

      {error && <Text style={styles.error}>{error}</Text>}
      <FlatList
        data={data?.memories ?? []}
        keyExtractor={(m) => m.id}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={reload} />}
        ListEmptyComponent={
          <Text style={[styles.empty, { color: palette.muted }]}>
            Nothing written yet. Journal entries you add on the website appear here.
          </Text>
        }
        renderItem={({ item }) => (
          <Pressable
            onPress={() => setEditing(item)}
            style={[styles.entry, { borderBottomColor: palette.border }]}
          >
            <Text style={[styles.date, { color: palette.muted }]}>
              {when(item)}
              {item.place ? ` · ${item.place.name}` : ""}
              {item.trip ? ` · ${item.trip.title}` : ""}
            </Text>
            {item.title && (
              <Text style={[styles.title, { color: palette.ink }]}>{item.title}</Text>
            )}
            <Text style={[styles.body, { color: palette.ink }]} numberOfLines={6}>
              {item.body}
            </Text>
            {item.photos.length > 0 && (
              <Text style={[styles.photos, { color: palette.accentText }]}>
                {item.photos.length} photo{item.photos.length === 1 ? "" : "s"}
              </Text>
            )}
          </Pressable>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  centre: { flex: 1, alignItems: "center", justifyContent: "center" },
  error: { color: "#E07A5F", padding: 16 },
  empty: { textAlign: "center", padding: 32, lineHeight: 20 },
  new: { margin: 12, borderRadius: 10, alignItems: "center", paddingVertical: 12 },
  entry: { paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth },
  date: { fontSize: 12 },
  title: { fontSize: 16, fontWeight: "600", marginTop: 4 },
  body: { fontSize: 14, marginTop: 4, lineHeight: 20 },
  photos: { fontSize: 12, marginTop: 6, fontWeight: "500" },
});
