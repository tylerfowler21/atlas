/// Apps, passes and paperwork for one trip.
///
/// The transit app that wants a card registered before you land, the pass that
/// is cheaper bought at home, the visa with a lead time. These live in a group
/// chat until the morning they are needed, which is the one morning nobody can
/// find them.
import { useState } from "react";
import {
  Alert,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { RESOURCE_KINDS, resourceKind } from "@/lib/resources";
import { api, type TripResource } from "@/lib/api";
import { usePalette } from "@/lib/use-palette";

export default function TripResources({
  tripId,
  resources,
  onChanged,
}: {
  tripId: string;
  resources: TripResource[];
  onChanged: () => void;
}) {
  const palette = usePalette();
  const [label, setLabel] = useState("");
  const [url, setUrl] = useState("");
  const [kind, setKind] = useState("app");
  const [busy, setBusy] = useState(false);

  async function add() {
    if (!label.trim()) return;
    setBusy(true);
    try {
      await api(`/api/trips/${tripId}/resources`, {
        method: "POST",
        body: JSON.stringify({ label: label.trim(), url: url.trim() || null, kind }),
      });
      setLabel("");
      setUrl("");
      onChanged();
    } catch (e) {
      Alert.alert("Could not add that", e instanceof Error ? e.message : "Try again");
    } finally {
      setBusy(false);
    }
  }

  async function patch(r: TripResource, changes: Record<string, unknown>) {
    try {
      await api(`/api/resources/${r.id}`, { method: "PATCH", body: JSON.stringify(changes) });
      onChanged();
    } catch (e) {
      Alert.alert("Could not save that", e instanceof Error ? e.message : "Try again");
    }
  }

  function remove(r: TripResource) {
    Alert.alert(`Remove ${r.label}?`, undefined, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: async () => {
          try {
            await api(`/api/resources/${r.id}`, { method: "DELETE" });
            onChanged();
          } catch (e) {
            Alert.alert("Could not remove that", e instanceof Error ? e.message : "Try again");
          }
        },
      },
    ]);
  }

  const waiting = resources.filter((r) => !r.ready).length;

  return (
    <View style={styles.body}>
      {resources.length === 0 ? (
        <Text style={{ color: palette.muted, fontSize: 13, lineHeight: 19 }}>
          The apps, passes and paperwork this trip needs — the transit app, the
          rail pass worth buying early, the offline map, the visa form.
        </Text>
      ) : (
        <Text style={{ color: palette.muted, fontSize: 12, marginBottom: 8 }}>
          {waiting === 0 ? "All sorted" : `${waiting} to sort out`}
        </Text>
      )}

      {resources.map((r) => {
        const meta = resourceKind(r.kind);
        return (
          <View
            key={r.id}
            style={[styles.row, { borderColor: palette.border, backgroundColor: palette.surface }]}
          >
            <Pressable
              onPress={() => patch(r, { ready: !r.ready })}
              hitSlop={6}
              accessibilityLabel={`Mark ${r.label} ${r.ready ? "not sorted" : "sorted"}`}
            >
              <Text style={{ fontSize: 18 }}>{r.ready ? "☑️" : "⬜️"}</Text>
            </Pressable>
            <Text style={{ fontSize: 15 }}>{meta.icon}</Text>
            <Pressable
              style={{ flex: 1 }}
              disabled={!r.url}
              onPress={() => r.url && Linking.openURL(r.url)}
            >
              <Text
                style={[
                  styles.label,
                  { color: r.ready ? palette.muted : r.url ? palette.accentText : palette.ink },
                  r.ready && styles.struck,
                ]}
                numberOfLines={2}
              >
                {r.label}
              </Text>
              {r.note ? (
                <Text style={{ color: palette.muted, fontSize: 12 }} numberOfLines={1}>
                  {r.note}
                </Text>
              ) : null}
            </Pressable>
            <Pressable onPress={() => remove(r)} hitSlop={8}>
              <Text style={{ color: palette.muted, fontSize: 18 }}>×</Text>
            </Pressable>
          </View>
        );
      })}

      <View style={styles.chips}>
        {RESOURCE_KINDS.map((k) => (
          <Pressable
            key={k.id}
            onPress={() => setKind(k.id)}
            style={[
              styles.chip,
              { borderColor: kind === k.id ? palette.accent : palette.border },
            ]}
          >
            <Text style={{ fontSize: 12, color: palette.ink }}>
              {k.icon} {k.label}
            </Text>
          </Pressable>
        ))}
      </View>

      <TextInput
        value={label}
        onChangeText={setLabel}
        placeholder="SBB Mobile, Swiss Travel Pass, passport…"
        placeholderTextColor={palette.muted}
        style={[styles.input, { color: palette.ink, borderColor: palette.border }]}
      />
      <TextInput
        value={url}
        onChangeText={setUrl}
        autoCapitalize="none"
        keyboardType="url"
        placeholder="Link (optional)"
        placeholderTextColor={palette.muted}
        style={[styles.input, { color: palette.ink, borderColor: palette.border }]}
      />
      <Pressable
        onPress={add}
        disabled={busy || !label.trim()}
        style={[
          styles.add,
          { backgroundColor: palette.accent, opacity: busy || !label.trim() ? 0.5 : 1 },
        ]}
      >
        <Text style={{ color: palette.onAccent, fontWeight: "600", fontSize: 14 }}>Add</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  body: { paddingHorizontal: 16, paddingBottom: 32 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    borderWidth: 1,
    borderRadius: 10,
    padding: 11,
    marginBottom: 8,
  },
  label: { fontSize: 15 },
  struck: { textDecorationLine: "line-through" },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 14, marginBottom: 8 },
  chip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 11, paddingVertical: 6 },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 11,
    fontSize: 14,
    marginBottom: 8,
  },
  add: { borderRadius: 10, alignItems: "center", paddingVertical: 12 },
});
