import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import TripEditor from "@/components/TripEditor";
import { API_URL, api, type ItineraryItem, type Trip } from "@/lib/api";
import { stopIcon } from "@/lib/taxonomy";
import { useApi } from "@/lib/use-api";
import { usePalette } from "@/lib/use-palette";

type TripResponse = { trip: Trip; role: string; items: ItineraryItem[] };

/// A trip runs from its start date; without one it is still a list of days,
/// just unlabelled ones. Matching the website, which lets a trip exist before
/// anyone has decided when it happens.
function dayLabel(trip: Trip, index: number) {
  if (!trip.startDate) return `Day ${index + 1}`;
  const date = new Date(trip.startDate);
  date.setDate(date.getDate() + index);
  return date.toLocaleDateString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

function dayCount(trip: Trip, items: ItineraryItem[]) {
  const fromDates =
    trip.startDate && trip.endDate
      ? Math.round(
          (new Date(trip.endDate).getTime() - new Date(trip.startDate).getTime()) / 86_400_000,
        ) + 1
      : 0;
  // Never fewer days than there are entries, or a stop could have nowhere to be.
  const fromItems = items.reduce((n, i) => Math.max(n, i.dayIndex + 1), 0);
  return Math.max(1, fromDates, fromItems);
}

export default function TripScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data, error, loading, reload } = useApi<TripResponse>(`/api/trips/${id}`);
  const palette = usePalette();

  const router = useRouter();
  const [settings, setSettings] = useState(false);
  const [adding, setAdding] = useState<number | null>(null);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);

  const days = useMemo(
    () => (data ? dayCount(data.trip, data.items) : 0),
    [data],
  );

  const addStop = useCallback(
    async (dayIndex: number) => {
      const title = draft.trim();
      if (!title) return;
      setBusy(true);
      try {
        await api(`/api/trips/${id}/items`, {
          method: "POST",
          body: JSON.stringify({ title, dayIndex, kind: "stop" }),
        });
        setDraft("");
        setAdding(null);
        reload();
      } catch (e) {
        Alert.alert("Could not add that", e instanceof Error ? e.message : "Try again");
      } finally {
        setBusy(false);
      }
    },
    [draft, id, reload],
  );

  /// A share link is a secret URL: anyone holding it can read the itinerary
  /// without an account, which is the point. Created on demand, and handed
  /// straight to the system share sheet so it can go wherever it is needed.
  const share = useCallback(async () => {
    try {
      // The endpoint returns a path, not a URL — it has no opinion about which
      // host is serving it — so the address is assembled here.
      const { share: link } = await api<{ share: { path: string } }>(
        `/api/trips/${id}/share`,
        { method: "POST" },
      );
      await Share.share({ message: `${API_URL}${link.path}` });
    } catch (e) {
      Alert.alert("Could not make a link", e instanceof Error ? e.message : "Try again");
    }
  }, [id]);

  const rename = useCallback(
    async (item: ItineraryItem, title: string) => {
      const next = title.trim();
      if (!next || next === item.title) return;
      try {
        await api(`/api/items/${item.id}`, {
          method: "PATCH",
          body: JSON.stringify({ title: next }),
        });
        reload();
      } catch (e) {
        Alert.alert("Could not rename that", e instanceof Error ? e.message : "Try again");
      }
    },
    [reload],
  );

  const remove = useCallback(
    (item: ItineraryItem) => {
      Alert.alert(item.title, "Remove this from the trip?", [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: async () => {
            try {
              await api(`/api/items/${item.id}`, { method: "DELETE" });
              reload();
            } catch (e) {
              Alert.alert("Could not remove that", e instanceof Error ? e.message : "Try again");
            }
          },
        },
      ]);
    },
    [reload],
  );

  if (loading && !data) {
    return (
      <View style={[styles.centre, { backgroundColor: palette.background }]}>
        <ActivityIndicator />
      </View>
    );
  }
  if (error || !data) {
    return (
      <View style={[styles.centre, { backgroundColor: palette.background }]}>
        <Text style={{ color: palette.muted }}>{error ?? "Trip not found"}</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <Stack.Screen
        options={{
          title: data.trip.title,
          headerRight: () => (
            <Pressable onPress={() => setSettings(true)} hitSlop={10}>
              <Text style={{ color: palette.accentText, fontSize: 15 }}>Edit</Text>
            </Pressable>
          ),
        }}
      />

      {settings && (
        <TripEditor
          trip={data.trip}
          onClose={() => setSettings(false)}
          onSaved={(tripId) => {
            // An empty id means it was deleted; there is nothing to go back to.
            if (tripId) reload();
            else router.back();
          }}
        />
      )}
      <ScrollView style={[styles.fill, { backgroundColor: palette.background }]}>
        {Array.from({ length: days }, (_, day) => {
          const stops = data.items.filter((i) => i.dayIndex === day);
          return (
            <View key={day} style={styles.day}>
              <Text style={[styles.dayLabel, { color: palette.muted }]}>
                {dayLabel(data.trip, day)}
              </Text>

              {stops.map((item) => (
                <View
                  key={item.id}
                  style={[
                    styles.stop,
                    { backgroundColor: palette.surface, borderColor: palette.border },
                  ]}
                >
                  <Text style={styles.glyph}>{stopIcon(item)}</Text>
                  <TextInput
                    defaultValue={item.title}
                    onEndEditing={(e) => rename(item, e.nativeEvent.text)}
                    style={[styles.stopTitle, { color: palette.ink }]}
                    returnKeyType="done"
                  />
                  <Pressable onPress={() => remove(item)} hitSlop={10}>
                    <Text style={{ color: palette.muted, fontSize: 18 }}>×</Text>
                  </Pressable>
                </View>
              ))}

              {adding === day ? (
                <View
                  style={[
                    styles.stop,
                    { backgroundColor: palette.surface, borderColor: palette.accent },
                  ]}
                >
                  <TextInput
                    value={draft}
                    onChangeText={setDraft}
                    placeholder="What are you doing?"
                    placeholderTextColor={palette.muted}
                    autoFocus
                    onSubmitEditing={() => addStop(day)}
                    returnKeyType="done"
                    style={[styles.stopTitle, { color: palette.ink }]}
                  />
                  <Pressable onPress={() => addStop(day)} disabled={busy} hitSlop={10}>
                    <Text style={{ color: palette.accentText, fontWeight: "600" }}>Add</Text>
                  </Pressable>
                </View>
              ) : (
                <Pressable
                  onPress={() => {
                    setDraft("");
                    setAdding(day);
                  }}
                  style={styles.add}
                >
                  <Text style={{ color: palette.accentText, fontSize: 14 }}>+ Add something</Text>
                </Pressable>
              )}
            </View>
          );
        })}
        <Pressable onPress={share} style={styles.share}>
          <Text style={{ color: palette.accentText, fontSize: 14 }}>
            Share a read-only link
          </Text>
        </Pressable>

        <View style={{ height: 40 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  centre: { flex: 1, alignItems: "center", justifyContent: "center" },
  day: { paddingHorizontal: 12, paddingTop: 16 },
  dayLabel: { fontSize: 12, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.5 },
  stop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginTop: 8,
  },
  glyph: { fontSize: 18 },
  stopTitle: { flex: 1, fontSize: 15, paddingVertical: 2 },
  add: { paddingVertical: 10, paddingHorizontal: 4, marginTop: 4 },
  share: { alignItems: "center", paddingVertical: 18, marginTop: 12 },
});
