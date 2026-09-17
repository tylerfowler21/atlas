import { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { api, type TripResource } from "@/lib/api";
import { PACKING_KIND } from "@/lib/resources";
import { type } from "@/lib/type";
import { usePalette } from "@/lib/use-palette";

/// What to put in the bag.
///
/// The same rows as "Before you go", in the same table, through the same
/// routes — a packing item is a label, a tick and an order, which is what a
/// resource already is. What differs is the screen and the hands: four passes
/// and twenty pairs of socks do not belong in one list, and a packing list is
/// written in one go at eleven at night rather than an item a week.
///
/// So this is a box that takes a word and stays open for the next one. No kind
/// to pick, no link to paste. And the tick happens at once rather than after
/// the server answers — packing is done standing over a suitcase with one hand
/// free, and a tick that waits is a tick somebody presses twice.

export default function TripPacking({
  tripId,
  items,
  startDate,
  onChanged,
}: {
  tripId: string;
  items: TripResource[];
  /// Only so the list can say when it will remind you. The reminder itself is
  /// scheduled by the trip screen, off the same two facts.
  startDate: string | null;
  onChanged: () => void;
}) {
  const palette = usePalette();
  const [label, setLabel] = useState("");
  const [busy, setBusy] = useState(false);
  /// Ticks that have happened here but may not have reached the server yet.
  const [ticked, setTicked] = useState<Record<string, boolean>>({});

  const packed = (item: TripResource) => ticked[item.id] ?? item.ready;
  const left = items.filter((i) => !packed(i)).length;
  /// Whether there is still an evening before to be reminded on.
  ///
  /// The clock is read once when the screen opens rather than on every render:
  /// a render is meant to give the same answer twice, and "is this date in the
  /// future" read mid-render does not. Nobody holds a packing list open long
  /// enough for the difference to matter.
  const [opened] = useState(() => Date.now());
  const leavesLater = startDate ? new Date(startDate).getTime() > opened : false;

  async function add() {
    const what = label.trim();
    if (!what || busy) return;
    setBusy(true);
    setLabel("");
    try {
      await api(`/api/trips/${tripId}/resources`, {
        method: "POST",
        body: JSON.stringify({ label: what, kind: PACKING_KIND }),
      });
      onChanged();
    } catch {
      setLabel(what);
    } finally {
      setBusy(false);
    }
  }

  async function tick(item: TripResource) {
    const next = !packed(item);
    setTicked((was) => ({ ...was, [item.id]: next }));
    try {
      await api(`/api/resources/${item.id}`, {
        method: "PATCH",
        body: JSON.stringify({ ready: next }),
      });
    } catch {
      setTicked((was) => ({ ...was, [item.id]: !next }));
    }
  }

  async function remove(item: TripResource) {
    try {
      await api(`/api/resources/${item.id}`, { method: "DELETE" });
      onChanged();
    } catch {
      // Left where it is. Nothing was lost, and the row is still tappable.
    }
  }

  return (
    <View style={styles.wrap}>
      <View style={styles.heading}>
        <Text style={[type.item, { color: palette.ink }]}>Packing</Text>
        {items.length > 0 && (
          <Text style={[type.meta, { color: palette.muted }]}>
            {left === 0 ? "all packed" : `${left} to pack`}
          </Text>
        )}
      </View>

      {items.map((item) => (
        <View key={item.id} style={[styles.row, { borderBottomColor: palette.border }]}>
          <Pressable
            onPress={() => void tick(item)}
            hitSlop={8}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: packed(item) }}
            accessibilityLabel={`Packed ${item.label}`}
          >
            <Text style={{ fontSize: 18 }}>{packed(item) ? "☑️" : "⬜️"}</Text>
          </Pressable>

          <Text
            style={[
              type.body,
              styles.label,
              { color: packed(item) ? palette.muted : palette.ink },
              packed(item) && styles.struck,
            ]}
            numberOfLines={2}
          >
            {item.label}
          </Text>

          <Pressable onPress={() => void remove(item)} hitSlop={8}>
            <Text style={[type.meta, { color: palette.muted }]}>Remove</Text>
          </Pressable>
        </View>
      ))}

      {/* An invisible reminder is a surprise. Said here rather than left to
          arrive unannounced — and only when there is actually going to be
          one, so it is never a promise the phone will not keep. */}
      {left > 0 && leavesLater && (
        <Text style={[type.meta, styles.promise, { color: palette.muted }]}>
          You&apos;ll be reminded the evening before you leave.
        </Text>
      )}

      <TextInput
        style={[
          styles.field,
          { borderColor: palette.border, color: palette.ink, backgroundColor: palette.surface },
        ]}
        placeholder="Passport, adapter, walking shoes…"
        placeholderTextColor={palette.muted}
        value={label}
        onChangeText={setLabel}
        onSubmitEditing={() => void add()}
        // The keyboard stays up and the box stays empty, so the next thing can
        // be typed straight away — which is how a packing list gets written.
        blurOnSubmit={false}
        returnKeyType="next"
        editable={!busy}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 2, marginTop: 20 },
  heading: { flexDirection: "row", alignItems: "baseline", gap: 8, marginBottom: 6 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  label: { flex: 1 },
  struck: { textDecorationLine: "line-through" },
  field: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, marginTop: 10 },
  promise: { marginTop: 10 },
});
