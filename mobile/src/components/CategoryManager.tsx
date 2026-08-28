/// Making your own categories, from the phone.
///
/// The same thing the website's settings page does, because a category made in
/// one has to be usable in the other — they are the same list.
import { useState } from "react";
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { api } from "@/lib/api";
import { useCategories } from "@/lib/categories";
import { usePalette } from "@/lib/use-palette";
import { type Category } from "@/lib/taxonomy";

/// Enough to tell pins apart at a glance, and all from the brand palette so a
/// map full of custom categories still looks like one map.
const COLORS = [
  "#14B8A6", "#0F2D4A", "#ef4444", "#f59e0b", "#a855f7",
  "#10b981", "#0ea5e9", "#ec4899", "#6366f1", "#b45309",
];

export default function CategoryManager() {
  const palette = usePalette();
  const { everyCategory, setCustom, refresh } = useCategories();
  const custom = everyCategory.filter((c) => c.custom);
  const builtIn = everyCategory.filter((c) => !c.custom);

  /// Hiding, showing and restyling all go through the same PATCH — the server
  /// records a change against this person rather than editing a shared
  /// category.
  async function patchCategory(c: Category, body: Partial<Category>) {
    try {
      await api(`/api/categories/${c.id}`, { method: "PATCH", body: JSON.stringify(body) });
      setCustom(everyCategory.map((x) => (x.id === c.id ? { ...x, ...body } : x)));
    } catch {
      Alert.alert("Could not save that change");
    }
  }

  /// Puts a built-in back the way it came — un-hiding it and dropping any
  /// restyle at once, which is what "default" means on the row.
  async function resetCategory(c: Category) {
    try {
      await api(`/api/categories/${c.id}`, { method: "DELETE" });
      await refresh();
    } catch {
      Alert.alert("Could not reset that category");
    }
  }

  const [adding, setAdding] = useState(false);
  const [label, setLabel] = useState("");
  const [icon, setIcon] = useState("📌");
  const [color, setColor] = useState(COLORS[0]!);
  const [busy, setBusy] = useState(false);

  function reset() {
    setAdding(false);
    setLabel("");
    setIcon("📌");
    setColor(COLORS[0]!);
  }

  async function create() {
    const name = label.trim();
    if (!name || busy) return;
    setBusy(true);
    try {
      const { category } = await api<{ category: Category }>("/api/categories", {
        method: "POST",
        body: JSON.stringify({ label: name, icon: icon.trim() || "📌", color }),
      });
      setCustom([...everyCategory, category]);
      reset();
    } catch (e) {
      Alert.alert(
        "Could not add that",
        e instanceof Error ? e.message : "Try a different name",
      );
    } finally {
      setBusy(false);
    }
  }

  function remove(c: Category) {
    Alert.alert(
      c.label,
      "Delete this category? Anything filed under it moves to Other. No places are deleted.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await api(`/api/categories/${c.id}`, { method: "DELETE" });
              setCustom(everyCategory.filter((x) => x.id !== c.id));
            } catch {
              Alert.alert("Could not delete that category");
            }
          },
        },
      ],
    );
  }

  return (
    <View>
      <Text style={[styles.label, { color: palette.muted }]}>Your categories</Text>

      {custom.map((c) => (
        <View key={c.id} style={[styles.row, { borderColor: palette.border }]}>
          <View style={[styles.swatch, { borderColor: c.color, backgroundColor: `${c.color}22` }]}>
            <Text style={{ fontSize: 14 }}>{c.icon}</Text>
          </View>
          <Text style={[styles.rowLabel, { color: palette.ink }]} numberOfLines={1}>
            {c.label}
          </Text>
          <Pressable onPress={() => remove(c)} hitSlop={8}>
            <Text style={{ color: palette.muted, fontSize: 13 }}>Delete</Text>
          </Pressable>
        </View>
      ))}

      {custom.length === 0 && !adding && (
        <Text style={{ color: palette.muted, fontSize: 12, marginTop: 4 }}>
          The built-in ones cover most places. Add your own for the ones they don&apos;t.
        </Text>
      )}

      {adding ? (
        <View style={[styles.form, { borderColor: palette.border }]}>
          <TextInput
            value={label}
            onChangeText={setLabel}
            placeholder="Dive sites"
            placeholderTextColor={palette.muted}
            maxLength={30}
            style={[styles.input, { color: palette.ink, borderColor: palette.border }]}
          />
          <View style={styles.inline}>
            <TextInput
              value={icon}
              onChangeText={setIcon}
              maxLength={4}
              style={[styles.emoji, { color: palette.ink, borderColor: palette.border }]}
            />
            <Text style={{ color: palette.muted, fontSize: 12, flex: 1 }}>
              Tap to pick an emoji from your keyboard
            </Text>
          </View>

          <View style={styles.colors}>
            {COLORS.map((c) => (
              <Pressable
                key={c}
                onPress={() => setColor(c)}
                style={[
                  styles.color,
                  { backgroundColor: c },
                  color === c && { borderWidth: 3, borderColor: palette.ink },
                ]}
              />
            ))}
          </View>

          <View style={styles.inline}>
            <Pressable
              onPress={create}
              disabled={!label.trim() || busy}
              style={[
                styles.button,
                { backgroundColor: palette.accent, opacity: !label.trim() || busy ? 0.5 : 1 },
              ]}
            >
              <Text style={{ color: palette.onAccent, fontWeight: "600" }}>Add</Text>
            </Pressable>
            <Pressable onPress={reset} style={styles.button}>
              <Text style={{ color: palette.muted }}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      ) : (
        <Pressable onPress={() => setAdding(true)} style={styles.link}>
          <Text style={{ color: palette.accentText, fontSize: 14 }}>New category</Text>
        </Pressable>
      )}

      <Text style={[styles.label, { color: palette.muted }]}>
        The ones that come with Roava
      </Text>
      <Text style={{ color: palette.muted, fontSize: 12, marginBottom: 8 }}>
        Change the emoji, or hide the ones you don&apos;t use. Places already
        filed under a hidden one keep it.
      </Text>

      {builtIn.map((c) => (
        <View
          key={c.id}
          style={[styles.row, { borderColor: palette.border }, c.hidden && { opacity: 0.55 }]}
        >
          <TextInput
            value={c.icon}
            maxLength={4}
            onChangeText={(icon) => {
              const next = icon.trim();
              if (next) void patchCategory(c, { icon: next });
            }}
            style={[styles.swatch, { borderColor: c.color, color: palette.ink, fontSize: 15 }]}
          />
          <Text style={[styles.rowLabel, { color: palette.ink }]} numberOfLines={1}>
            {c.label}
            {c.hidden ? " · hidden" : ""}
          </Text>

          {c.id === "other" ? (
            <Text style={{ color: palette.muted, fontSize: 12 }}>Always on</Text>
          ) : (
            <Pressable onPress={() => void patchCategory(c, { hidden: !c.hidden })} hitSlop={8}>
              <Text style={{ color: palette.muted, fontSize: 12 }}>
                {c.hidden ? "Show" : "Hide"}
              </Text>
            </Pressable>
          )}

          {(c.edited || c.hidden) && (
            <Pressable onPress={() => void resetCategory(c)} hitSlop={8}>
              <Text style={{ color: palette.muted, fontSize: 12 }}>Default</Text>
            </Pressable>
          )}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  label: {
    fontSize: 12,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginTop: 28,
    marginBottom: 6,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginBottom: 6,
  },
  swatch: { width: 28, height: 28, borderRadius: 14, borderWidth: 2, alignItems: "center", justifyContent: "center" },
  rowLabel: { flex: 1, fontSize: 14 },
  form: { borderWidth: 1, borderRadius: 10, padding: 10, gap: 10, marginTop: 4 },
  input: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, fontSize: 14 },
  emoji: { borderWidth: 1, borderRadius: 8, width: 52, textAlign: "center", paddingVertical: 8, fontSize: 18 },
  inline: { flexDirection: "row", alignItems: "center", gap: 10 },
  colors: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  color: { width: 28, height: 28, borderRadius: 14 },
  button: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8 },
  link: { paddingVertical: 8 },
});
