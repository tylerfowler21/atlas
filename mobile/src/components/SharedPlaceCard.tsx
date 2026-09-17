import { Pressable, StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import type { SharedPlace } from "@/lib/api";
import { type } from "@/lib/type";
import { usePalette } from "@/lib/use-palette";

/// Somebody else's place, read-only.
///
/// Deliberately not the usual place sheet with its buttons taken out. That one
/// is for a place you own — status, rating, trips, delete — and hiding most of
/// it would leave something that looks like yours and is not. This says the
/// four things that matter about a stranger's pin: what it is, who has been,
/// what they thought, and where to read more about them.
export default function SharedPlaceCard({
  place,
  onClose,
}: {
  place: SharedPlace;
  onClose: () => void;
}) {
  const palette = usePalette();
  const router = useRouter();
  const who = place.user.name ?? (place.user.username ? `@${place.user.username}` : "Someone");

  return (
    <View style={[styles.card, { backgroundColor: palette.surface, borderColor: palette.border }]}>
      <View style={styles.head}>
        <View style={styles.headText}>
          <Text style={[type.section, { color: palette.ink }]} numberOfLines={2}>
            {place.name}
          </Text>
          <Text style={[type.meta, { color: palette.muted }]} numberOfLines={1}>
            {[place.city, place.country].filter(Boolean).join(", ")}
          </Text>
        </View>
        <Pressable onPress={onClose} hitSlop={10}>
          <Text style={[type.metaStrong, { color: palette.muted }]}>Close</Text>
        </Pressable>
      </View>

      {place.photoUrl && (
        <Image source={{ uri: place.photoUrl }} style={styles.photo} contentFit="cover" />
      )}

      <Pressable
        disabled={!place.user.username}
        onPress={() =>
          router.push({
            pathname: "/u/[username]",
            params: { username: place.user.username ?? "" },
          })
        }
      >
        <Text style={[type.body, { color: palette.ink }]}>
          <Text style={{ color: palette.accentText }}>{who}</Text>
          <Text style={{ color: palette.muted }}> has been here</Text>
          {place.rating ? (
            <Text style={{ color: palette.muted }}> · {"★".repeat(place.rating)}</Text>
          ) : null}
        </Text>
      </Pressable>

      {/* Their note, which is the whole reason this pin is worth tapping. */}
      {place.notes ? (
        <View style={[styles.note, { backgroundColor: palette.brandSurface }]}>
          <Text style={[type.body, { color: palette.ink }]}>{place.notes}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: 16, padding: 16, gap: 10 },
  head: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  headText: { flex: 1, gap: 2 },
  photo: { height: 140, borderRadius: 12 },
  note: { borderRadius: 12, padding: 12 },
});
