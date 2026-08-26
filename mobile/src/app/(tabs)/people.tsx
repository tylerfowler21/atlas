import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { api, type Person } from "@/lib/api";
import { useApi } from "@/lib/use-api";
import { usePalette } from "@/lib/use-palette";

export default function PeopleScreen() {
  const [query, setQuery] = useState("");
  const path = query.trim() ? `/api/people?q=${encodeURIComponent(query.trim())}` : "/api/people";
  const { data, error, loading, reload } = useApi<{ people: Person[] }>(path);
  const palette = usePalette();

  /// Follows are optimistic: the button flips immediately and the list is
  /// refetched afterwards. Waiting on the network to redraw a toggle makes the
  /// whole screen feel broken on a slow connection.
  const [pending, setPending] = useState<Record<string, boolean>>({});

  const toggle = useCallback(
    async (person: Person) => {
      // The API identifies people by username, not id — and only people with
      // one are listed, so this is always present.
      if (!person.username) return;

      setPending((p) => ({ ...p, [person.id]: !person.following }));
      try {
        if (person.following) {
          await api(`/api/follow?username=${encodeURIComponent(person.username)}`, {
            method: "DELETE",
          });
        } else {
          await api("/api/follow", {
            method: "POST",
            body: JSON.stringify({ username: person.username }),
          });
        }
      } catch {
        setPending((p) => {
          const next = { ...p };
          delete next[person.id];
          return next;
        });
        return;
      }
      reload();
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

  return (
    <View style={[styles.fill, { backgroundColor: palette.background }]}>
      <TextInput
        value={query}
        onChangeText={setQuery}
        placeholder="Search by name or username"
        placeholderTextColor={palette.muted}
        autoCapitalize="none"
        autoCorrect={false}
        style={[
          styles.search,
          { backgroundColor: palette.surface, borderColor: palette.border, color: palette.ink },
        ]}
      />

      {error && <Text style={styles.error}>{error}</Text>}

      <FlatList
        data={data?.people ?? []}
        keyExtractor={(p) => p.id}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={reload} />}
        ListEmptyComponent={
          <Text style={[styles.empty, { color: palette.muted }]}>
            {query ? "Nobody by that name." : "Nobody has picked a username yet."}
          </Text>
        }
        renderItem={({ item }) => {
          const following = pending[item.id] ?? item.following;
          return (
            <View style={[styles.row, { borderBottomColor: palette.border }]}>
              {item.image ? (
                <Image source={{ uri: item.image }} style={styles.avatar} />
              ) : (
                <View style={[styles.avatar, { backgroundColor: palette.brandSurface }]} />
              )}
              <View style={styles.body}>
                <Text style={[styles.name, { color: palette.ink }]} numberOfLines={1}>
                  {item.name ?? item.username}
                </Text>
                <Text style={[styles.meta, { color: palette.muted }]} numberOfLines={1}>
                  @{item.username} · {item.followers} follower
                  {item.followers === 1 ? "" : "s"} · {item.publishedTrips} trip
                  {item.publishedTrips === 1 ? "" : "s"}
                </Text>
              </View>
              <Pressable
                onPress={() => toggle(item)}
                style={[
                  styles.follow,
                  following
                    ? { borderColor: palette.border }
                    : { backgroundColor: palette.accent, borderColor: palette.accent },
                ]}
              >
                <Text
                  style={{
                    fontSize: 13,
                    fontWeight: "600",
                    color: following ? palette.muted : palette.onAccent,
                  }}
                >
                  {following ? "Following" : "Follow"}
                </Text>
              </Pressable>
            </View>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  centre: { flex: 1, alignItems: "center", justifyContent: "center" },
  error: { color: "#E07A5F", paddingHorizontal: 16 },
  empty: { textAlign: "center", padding: 32 },
  search: {
    margin: 12,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  avatar: { width: 40, height: 40, borderRadius: 20 },
  body: { flex: 1 },
  name: { fontSize: 15, fontWeight: "500" },
  meta: { fontSize: 12, marginTop: 2 },
  follow: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 7 },
});
