import { useState } from "react";
import DateRangePicker from "@/components/DateRangePicker";
import DestinationField from "@/components/DestinationField";
import { tripRegions } from "@/lib/trip-where";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { api, type Trip } from "@/lib/api";
import { TRIP_COLORS } from "@/lib/theme";
import { usePalette } from "@/lib/use-palette";

/// Dates as text rather than a picker.
///
/// A native date picker is two taps and a scroll wheel per date; typing
/// "2026-09-18" is one. It is also what the website's date input produces, so
/// the two agree about what a date looks like. Empty is allowed: a trip is
/// allowed to exist before anyone has decided when it happens.

export default function TripEditor({
  trip,
  onClose,
  onSaved,
}: {
  /// Null when creating.
  trip: Trip | null;
  onClose: () => void;
  onSaved: (tripId: string) => void;
}) {
  const palette = usePalette();
  const [title, setTitle] = useState(trip?.title ?? "");
  // Seeded from whichever field this trip has: one made before trips could go
  // to more than one place still has only the old one.
  const [destinations, setDestinations] = useState<string[]>(() =>
    trip ? tripRegions(trip) : [],
  );
  const [start, setStart] = useState(trip?.startDate?.slice(0, 10) ?? "");
  const [end, setEnd] = useState(trip?.endDate?.slice(0, 10) ?? "");
  const [color, setColor] = useState(trip?.color ?? TRIP_COLORS[0]);
  const [published, setPublished] = useState(Boolean(trip?.publishedAt));
  const [busy, setBusy] = useState(false);

  const editing = Boolean(trip);

  async function save() {
    const name = title.trim();
    if (!name) {
      Alert.alert("Give the trip a title");
      return;
    }
    if (start && end && end < start) {
      Alert.alert("Check the dates", "The trip ends before it starts.");
      return;
    }
    setBusy(true);
    try {
      const body = {
        title: name,
        destinations,
        startDate: start || null,
        endDate: end || null,
        color,
        ...(editing ? { published } : {}),
      };
      const saved = await api<{ trip: Trip }>(
        editing ? `/api/trips/${trip!.id}` : "/api/trips",
        { method: editing ? "PATCH" : "POST", body: JSON.stringify(body) },
      );
      onSaved(saved.trip?.id ?? trip!.id);
      onClose();
    } catch (e) {
      Alert.alert("Could not save", e instanceof Error ? e.message : "Try again");
    } finally {
      setBusy(false);
    }
  }

  function remove() {
    Alert.alert(trip!.title, "Delete this trip and everything in it?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            await api(`/api/trips/${trip!.id}`, { method: "DELETE" });
            onSaved("");
            onClose();
          } catch (e) {
            Alert.alert("Could not delete", e instanceof Error ? e.message : "Try again");
          }
        },
      },
    ]);
  }

  const field = {
    backgroundColor: palette.surface,
    borderColor: palette.border,
    color: palette.ink,
  };

  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={[styles.header, { borderBottomColor: palette.border, backgroundColor: palette.surface }]}>
          <Pressable onPress={onClose} hitSlop={10}>
            <Text style={{ color: palette.muted, fontSize: 16 }}>Cancel</Text>
          </Pressable>
          <Text style={[styles.headerTitle, { color: palette.ink }]}>
            {editing ? "Trip settings" : "New trip"}
          </Text>
          <Pressable onPress={save} disabled={busy} hitSlop={10}>
            {busy ? (
              <ActivityIndicator />
            ) : (
              <Text style={{ color: palette.accentText, fontSize: 16, fontWeight: "600" }}>Save</Text>
            )}
          </Pressable>
        </View>

        <ScrollView style={{ backgroundColor: palette.background }} contentContainerStyle={styles.body}>
          <Text style={[styles.label, { color: palette.muted }]}>Title</Text>
          <TextInput
            value={title}
            onChangeText={setTitle}
            placeholder="Lisbon, long weekend"
            placeholderTextColor={palette.muted}
            style={[styles.input, field]}
          />

          <Text style={[styles.label, { color: palette.muted }]}>Where it goes</Text>
          <DestinationField value={destinations} onChange={setDestinations} />

          <Text style={[styles.label, { color: palette.muted }]}>When</Text>
          {/* Pointed at rather than typed. A trip with no dates is still a
              trip, so nothing here is required — leave it untouched and the
              trip simply has none. */}
          <DateRangePicker
            start={start}
            end={end}
            onChange={({ start: nextStart, end: nextEnd }) => {
              setStart(nextStart);
              setEnd(nextEnd);
            }}
          />

          <Text style={[styles.label, { color: palette.muted }]}>Colour</Text>
          <View style={styles.colors}>
            {TRIP_COLORS.map((c) => (
              <Pressable
                key={c}
                onPress={() => setColor(c)}
                style={[
                  styles.swatch,
                  { backgroundColor: c },
                  color === c && { borderColor: palette.ink, borderWidth: 3 },
                ]}
              />
            ))}
          </View>

          {editing && (
            <View style={[styles.publish, { borderColor: palette.border, backgroundColor: palette.surface }]}>
              <View style={{ flex: 1 }}>
                <Text style={{ color: palette.ink, fontSize: 15, fontWeight: "500" }}>
                  Published
                </Text>
                <Text style={{ color: palette.muted, fontSize: 12, marginTop: 2 }}>
                  Puts it on your profile and in your followers&apos; feeds.
                </Text>
              </View>
              <Switch
                value={published}
                onValueChange={setPublished}
                trackColor={{ true: palette.accent }}
              />
            </View>
          )}

          {editing && (
            <Pressable onPress={remove} style={styles.remove}>
              <Text style={{ color: "#E07A5F", fontWeight: "500" }}>Delete this trip</Text>
            </Pressable>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerTitle: { fontSize: 16, fontWeight: "600" },
  body: { padding: 16, paddingBottom: 48 },
  label: { fontSize: 12, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.5, marginTop: 18, marginBottom: 6 },
  input: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15 },
  colors: { flexDirection: "row", gap: 12 },
  swatch: { width: 38, height: 38, borderRadius: 19, borderWidth: 0, borderColor: "transparent" },
  publish: { flexDirection: "row", alignItems: "center", gap: 12, borderWidth: 1, borderRadius: 10, padding: 12, marginTop: 24 },
  remove: { marginTop: 24, alignItems: "center", paddingVertical: 12 },
});
