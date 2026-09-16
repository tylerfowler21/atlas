import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Link } from "expo-router";
import { api } from "@/lib/api";
import { type } from "@/lib/type";
import { usePalette } from "@/lib/use-palette";
import { useApi } from "@/lib/use-api";

/// Who is worth following, shown to somebody following nobody.
///
/// An empty feed used to say "follow someone" and leave you to think of a
/// name. The people it names are chosen by one rule — they have published
/// trips, most first — which is honest enough to print on the row itself, and
/// keeps being right as more people publish without anybody maintaining a
/// list.
///
/// Nobody who has published nothing is offered. Following them leads straight
/// back to an empty feed, which is the thing that teaches people following is
/// pointless.

type Person = {
  id: string;
  name: string | null;
  username: string | null;
  bio: string | null;
  publishedTrips: number;
};

export default function SuggestedPeople() {
  const palette = usePalette();
  const { data } = useApi<{ people: Person[] }>("/api/people?suggested=1");
  const [followed, setFollowed] = useState<Record<string, boolean>>({});

  const people = data?.people ?? [];
  if (people.length === 0) return null;

  async function follow(person: Person) {
    if (!person.username) return;
    setFollowed((f) => ({ ...f, [person.id]: true }));
    try {
      await api("/api/follow", {
        method: "POST",
        body: JSON.stringify({ username: person.username }),
      });
    } catch {
      setFollowed((f) => ({ ...f, [person.id]: false }));
    }
  }

  return (
    <View style={styles.wrap}>
      <Text style={[type.metaStrong, { color: palette.ink }]}>Worth following</Text>

      {people.map((person) => (
        <View
          key={person.id}
          style={[styles.row, { backgroundColor: palette.surface, borderColor: palette.border }]}
        >
          <View style={styles.who}>
            <Link href={{ pathname: "/u/[username]", params: { username: person.username ?? "" } }}>
              <Text style={[type.item, { color: palette.ink }]} numberOfLines={1}>
                {person.name ?? person.username}
              </Text>
            </Link>
            <Text style={[type.meta, { color: palette.muted }]} numberOfLines={1}>
              {person.publishedTrips} published{" "}
              {person.publishedTrips === 1 ? "trip" : "trips"}
              {person.bio ? ` · ${person.bio}` : ""}
            </Text>
          </View>

          <Pressable
            onPress={() => void follow(person)}
            disabled={followed[person.id]}
            style={[
              styles.follow,
              followed[person.id]
                ? { borderColor: palette.border }
                : { backgroundColor: palette.primary },
            ]}
          >
            <Text
              style={[
                type.metaStrong,
                { color: followed[person.id] ? palette.muted : palette.onPrimary },
              ]}
            >
              {followed[person.id] ? "Following" : "Follow"}
            </Text>
          </Pressable>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: 16, paddingTop: 4, paddingBottom: 12, gap: 8 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
  },
  who: { flex: 1, gap: 2 },
  follow: {
    minHeight: 36,
    justifyContent: "center",
    paddingHorizontal: 14,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "transparent",
  },
});
