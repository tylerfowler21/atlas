/// A trip's destinations, built by picking real ones.
///
/// It was a text box, so a trip's destination was whatever somebody typed —
/// "Swizerland", "the alps" — and the place search that leans on it got a hint
/// it could do nothing with. Suggestions come from the same gazetteer the
/// stops do. Typed text still counts: somewhere the gazetteer has never heard
/// of is still somewhere you went.
import { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { usePlaceSearch } from "@/lib/use-place-search";
import { searchPlaces } from "@/lib/search-places";
import { usePalette } from "@/lib/use-palette";
import type { SearchResult } from "@/lib/api";

function labelFor(result: SearchResult): string {
  // A city and its country, not a street address: this is the region a search
  // gets narrowed to, and "76 Queen Street" narrows it to nothing.
  const place = result.city ?? result.name;
  return [place, result.country].filter(Boolean).join(", ");
}

export default function DestinationField({
  value,
  onChange,
}: {
  value: string[];
  onChange: (next: string[]) => void;
}) {
  const palette = usePalette();
  const [query, setQuery] = useState("");
  const { results, searching } = usePlaceSearch(query, searchPlaces);

  // One entry per city rather than one per matching café in it.
  const suggestions = [...new Set(results.map(labelFor))]
    .filter((label) => !value.includes(label))
    .slice(0, 5);

  function add(name: string) {
    const trimmed = name.trim();
    if (!trimmed || value.includes(trimmed)) return;
    onChange([...value, trimmed]);
    setQuery("");
  }

  return (
    <View>
      {value.length > 0 && (
        <View style={styles.chips}>
          {value.map((name) => (
            <Pressable
              key={name}
              onPress={() => onChange(value.filter((n) => n !== name))}
              accessibilityLabel={`Remove ${name}`}
              style={[styles.chip, { borderColor: palette.accent }]}
            >
              <Text style={{ fontSize: 13, color: palette.ink }}>{name}</Text>
              <Text style={{ fontSize: 13, color: palette.muted }}>✕</Text>
            </Pressable>
          ))}
        </View>
      )}

      <TextInput
        value={query}
        onChangeText={setQuery}
        onSubmitEditing={() => add(query)}
        returnKeyType="done"
        placeholder={value.length > 0 ? "Add another" : "Lucerne, Interlaken, Zermatt…"}
        placeholderTextColor={palette.muted}
        style={[styles.input, { color: palette.ink, borderColor: palette.border }]}
      />

      {query.trim().length > 0 && (
        <View style={{ marginTop: 6 }}>
          {suggestions.map((label) => (
            <Pressable
              key={label}
              onPress={() => add(label)}
              style={[styles.suggestion, { borderColor: palette.border }]}
            >
              <Text style={{ fontSize: 13, color: palette.ink }}>{label}</Text>
            </Pressable>
          ))}
          {suggestions.length === 0 && (
            <Text style={{ fontSize: 12, color: palette.muted, paddingVertical: 4 }}>
              {searching ? "Looking…" : "Nothing found — done adds what you typed."}
            </Text>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 8 },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 11,
    paddingVertical: 6,
  },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 11,
    fontSize: 15,
  },
  suggestion: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 11,
    paddingVertical: 9,
    marginBottom: 5,
  },
});
