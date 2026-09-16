import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { api } from "@/lib/api";
import { type } from "@/lib/type";
import { usePalette } from "@/lib/use-palette";
import { useApi } from "@/lib/use-api";

/// The names behind your own "following" count.
///
/// The count was on the profile and the names were nowhere, so the only way to
/// see who you had followed was to remember. Unfollowing had the same problem:
/// you had to find the person again first.
///
/// Your own list only. Who somebody follows is a disclosure this profile has
/// never made — the counts are public, the names are not, which is the same
/// line the people directory draws between findable and listed.

type Person = {
  id: string;
  name: string | null;
  username: string | null;
  bio: string | null;
  publishedTrips: number;
};

export default function FollowingList() {
  const palette = usePalette();
  const router = useRouter();
  const { data } = useApi<{ people: Person[] }>("/api/following");
  const [dropped, setDropped] = useState<Record<string, boolean>>({});

  const people = data?.people ?? [];
  if (people.length === 0) return null;

  /// Both directions, because the row stays on screen after you unfollow. A
  /// button that says Follow and unfollows is worse than no button, and making
  /// the row vanish would take away the undo with it.
  async function toggle(person: Person) {
    if (!person.username) return;
    const gone = dropped[person.id] === true;
    setDropped((d) => ({ ...d, [person.id]: !gone }));
    try {
      if (gone) {
        await api("/api/follow", {
          method: "POST",
          body: JSON.stringify({ username: person.username }),
        });
      } else {
        await api(`/api/follow?username=${encodeURIComponent(person.username)}`, {
          method: "DELETE",
        });
      }
    } catch {
      setDropped((d) => ({ ...d, [person.id]: gone }));
    }
  }

  return (
    <View style={styles.wrap}>
      <Text style={[type.item, { color: palette.ink }]}>Following</Text>

      {people.map((person) => (
        <View
          key={person.id}
          style={[styles.row, { borderBottomColor: palette.border }]}
        >
          <Pressable
            style={styles.who}
            onPress={() =>
              router.push({
                pathname: "/u/[username]",
                params: { username: person.username ?? "" },
              })
            }
          >
            <Text style={[type.item, { color: palette.ink }]} numberOfLines={1}>
              {person.name ?? person.username}
            </Text>
            <Text style={[type.meta, { color: palette.muted }]} numberOfLines={1}>
              @{person.username} · {person.publishedTrips} published
              {person.bio ? ` · ${person.bio}` : ""}
            </Text>
          </Pressable>

          <Pressable
            onPress={() => void toggle(person)}
            style={[styles.action, { borderColor: palette.border }]}
            hitSlop={6}
          >
            <Text style={[type.metaStrong, { color: palette.muted }]}>
              {dropped[person.id] ? "Follow" : "Following"}
            </Text>
          </Pressable>
        </View>
      ))}

      <Text style={[type.meta, { color: palette.muted }]}>
        Only you can see this list. Your counts are public; the names are not.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: 18, gap: 4 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  who: { flex: 1, gap: 2 },
  action: {
    minHeight: 34,
    justifyContent: "center",
    paddingHorizontal: 12,
    borderRadius: 17,
    borderWidth: 1,
  },
});
