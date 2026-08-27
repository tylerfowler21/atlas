import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { API_URL, api, upload, type Memory, type Place, type Trip } from "@/lib/api";
import { usePalette } from "@/lib/use-palette";

const DATE_HINT = "YYYY-MM-DD";
function isDate(v: string) {
  return v === "" || /^\d{4}-\d{2}-\d{2}$/.test(v);
}

export default function MemoryEditor({
  memory,
  open,
  places,
  trips,
  onClose,
  onSaved,
}: {
  /// Null when writing something new.
  memory: Memory | null;
  open: boolean;
  places: Place[];
  trips: Trip[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const palette = usePalette();
  const [title, setTitle] = useState(memory?.title ?? "");
  const [body, setBody] = useState(memory?.body ?? "");
  const [happenedOn, setHappenedOn] = useState(memory?.happenedOn?.slice(0, 10) ?? "");
  const [placeId, setPlaceId] = useState(memory?.place?.id ?? null);
  const [tripId, setTripId] = useState(memory?.trip?.id ?? null);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [photos, setPhotos] = useState(memory?.photos ?? []);

  if (!open) return null;
  const editing = Boolean(memory);

  async function save(): Promise<string | null> {
    const text = body.trim();
    if (!text) {
      Alert.alert("Write something first");
      return null;
    }
    if (!isDate(happenedOn)) {
      Alert.alert("Check the date", `Use ${DATE_HINT}, or leave it empty.`);
      return null;
    }
    const payload = {
      title: title.trim() || null,
      body: text,
      happenedOn: happenedOn || null,
      placeId,
      tripId,
    };
    const saved = await api<{ memory: Memory }>(
      editing ? `/api/memories/${memory!.id}` : "/api/memories",
      { method: editing ? "PATCH" : "POST", body: JSON.stringify(payload) },
    );
    return saved.memory.id;
  }

  /// A photo needs an entry to belong to, so writing one first is not a
  /// convenience — it is the only order the API allows.
  async function addPhoto() {
    // Loaded when it is used, not when this screen is imported. It is a native
    // module, so a build made before it was added does not contain it — and a
    // top-level import would throw on startup, taking the whole app down over
    // a button nobody had pressed.
    let ImagePicker: typeof import("expo-image-picker");
    try {
      ImagePicker = await import("expo-image-picker");
    } catch {
      Alert.alert(
        "Photos need a newer build",
        "Attaching photos was added after the version installed on this phone. Everything else works; a new build enables it.",
      );
      return;
    }

    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert("Photos are not shared", "Allow photo access in Settings to attach one.");
      return;
    }
    const picked = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.8,
    });
    if (picked.canceled) return;

    setUploading(true);
    try {
      const id = editing ? memory!.id : await save();
      if (!id) return;

      const asset = picked.assets[0];
      const form = new FormData();
      form.append("memoryId", id);
      // React Native's FormData takes this shape for a local file rather than
      // a Blob — the uri is what the native side streams from.
      form.append("file", {
        uri: asset.uri,
        name: asset.fileName ?? "photo.jpg",
        type: asset.mimeType ?? "image/jpeg",
      } as unknown as Blob);

      const { photo } = await upload<{ photo: { id: string } }>("/api/photos", form);
      setPhotos((current) => [...current, photo]);
      onSaved();
    } catch (e) {
      Alert.alert("Could not add that photo", e instanceof Error ? e.message : "Try again");
    } finally {
      setUploading(false);
    }
  }

  async function done() {
    setBusy(true);
    try {
      if (await save()) {
        onSaved();
        onClose();
      }
    } catch (e) {
      Alert.alert("Could not save", e instanceof Error ? e.message : "Try again");
    } finally {
      setBusy(false);
    }
  }

  function remove() {
    Alert.alert("Delete this entry?", "The photos on it go too.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            await api(`/api/memories/${memory!.id}`, { method: "DELETE" });
            onSaved();
            onClose();
          } catch (e) {
            Alert.alert("Could not delete", e instanceof Error ? e.message : "Try again");
          }
        },
      },
    ]);
  }

  const field = { backgroundColor: palette.surface, borderColor: palette.border, color: palette.ink };

  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <View style={[styles.header, { borderBottomColor: palette.border, backgroundColor: palette.surface }]}>
          <Pressable onPress={onClose} hitSlop={10}>
            <Text style={{ color: palette.muted, fontSize: 16 }}>Cancel</Text>
          </Pressable>
          <Text style={[styles.headerTitle, { color: palette.ink }]}>
            {editing ? "Entry" : "New entry"}
          </Text>
          <Pressable onPress={done} disabled={busy} hitSlop={10}>
            {busy ? (
              <ActivityIndicator />
            ) : (
              <Text style={{ color: palette.accentText, fontSize: 16, fontWeight: "600" }}>Save</Text>
            )}
          </Pressable>
        </View>

        <ScrollView style={{ backgroundColor: palette.background }} contentContainerStyle={styles.body}>
          <TextInput
            value={title}
            onChangeText={setTitle}
            placeholder="Title (optional)"
            placeholderTextColor={palette.muted}
            style={[styles.input, styles.title, field]}
          />
          <TextInput
            value={body}
            onChangeText={setBody}
            multiline
            placeholder="What happened?"
            placeholderTextColor={palette.muted}
            style={[styles.input, styles.text, field]}
          />

          <Text style={[styles.label, { color: palette.muted }]}>When it happened</Text>
          <TextInput
            value={happenedOn}
            onChangeText={setHappenedOn}
            placeholder={DATE_HINT}
            placeholderTextColor={palette.muted}
            autoCapitalize="none"
            keyboardType="numbers-and-punctuation"
            style={[styles.input, field]}
          />

          <Picker label="Place" options={places.map((p) => ({ id: p.id, label: p.name }))}
            selected={placeId} onSelect={setPlaceId} palette={palette} />
          <Picker label="Trip" options={trips.map((t) => ({ id: t.id, label: t.title }))}
            selected={tripId} onSelect={setTripId} palette={palette} />

          <Text style={[styles.label, { color: palette.muted }]}>Photos</Text>
          <View style={styles.photos}>
            {photos.map((photo) => (
              <Image
                key={photo.id}
                source={{ uri: `${API_URL}/api/photos/${photo.id}` }}
                style={styles.thumb}
              />
            ))}
            <Pressable
              onPress={addPhoto}
              disabled={uploading}
              style={[styles.addPhoto, { borderColor: palette.border, backgroundColor: palette.surface }]}
            >
              {uploading ? <ActivityIndicator /> : <Text style={{ color: palette.muted, fontSize: 22 }}>+</Text>}
            </Pressable>
          </View>

          {editing && (
            <Pressable onPress={remove} style={styles.remove}>
              <Text style={{ color: "#E07A5F", fontWeight: "500" }}>Delete this entry</Text>
            </Pressable>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function Picker({
  label,
  options,
  selected,
  onSelect,
  palette,
}: {
  label: string;
  options: { id: string; label: string }[];
  selected: string | null;
  onSelect: (id: string | null) => void;
  palette: ReturnType<typeof usePalette>;
}) {
  if (options.length === 0) return null;
  return (
    <>
      <Text style={[styles.label, { color: palette.muted }]}>{label}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
        <Pressable
          onPress={() => onSelect(null)}
          style={[styles.chip, { backgroundColor: palette.surface, borderColor: selected ? palette.border : palette.accent }]}
        >
          <Text style={{ fontSize: 13, color: palette.muted }}>None</Text>
        </Pressable>
        {options.map((o) => (
          <Pressable
            key={o.id}
            onPress={() => onSelect(o.id)}
            style={[
              styles.chip,
              { backgroundColor: palette.surface, borderColor: selected === o.id ? palette.accent : palette.border },
            ]}
          >
            <Text style={{ fontSize: 13, color: selected === o.id ? palette.ink : palette.muted }} numberOfLines={1}>
              {o.label}
            </Text>
          </Pressable>
        ))}
      </ScrollView>
    </>
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
  title: { fontSize: 17, fontWeight: "600" },
  text: { minHeight: 160, textAlignVertical: "top", marginTop: 10, lineHeight: 21 },
  chips: { flexDirection: "row", gap: 8, paddingRight: 8 },
  chip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7, maxWidth: 200 },
  photos: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  thumb: { width: 84, height: 84, borderRadius: 10 },
  addPhoto: { width: 84, height: 84, borderRadius: 10, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  remove: { marginTop: 28, alignItems: "center", paddingVertical: 12 },
});
