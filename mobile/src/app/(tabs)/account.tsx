import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { API_URL, api, type Me, type Notification } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useApi } from "@/lib/use-api";
import { usePalette } from "@/lib/use-palette";

function ago(iso: string) {
  const minutes = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (minutes < 60) return `${Math.max(1, minutes)}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

export default function AccountScreen() {
  const palette = usePalette();
  const { user, signOut } = useAuth();
  const { data: me, reload: reloadMe } = useApi<{ user: Me }>("/api/me");
  const { data: notes, reload: reloadNotes } = useApi<{
    notifications: Notification[];
    unread: number;
  }>("/api/notifications");

  const [username, setUsername] = useState(user?.username ?? "");
  const [saving, setSaving] = useState(false);
  const [confirm, setConfirm] = useState("");
  const [deleting, setDeleting] = useState(false);

  const saveProfile = useCallback(async () => {
    const handle = username.trim().toLowerCase();
    if (!handle) return;
    setSaving(true);
    try {
      await api("/api/me", {
        method: "PATCH",
        body: JSON.stringify({ username: handle }),
      });
      reloadMe();
      Alert.alert("Saved", `You are @${handle}.`);
    } catch (e) {
      Alert.alert("Could not save", e instanceof Error ? e.message : "Try again");
    } finally {
      setSaving(false);
    }
  }, [username, reloadMe]);

  /// Deleting is irreversible and takes the photos with it, so it asks for the
  /// username typed out rather than a button that can be hit by accident — the
  /// same friction the website uses, for the same reason.
  const deleteAccount = useCallback(async () => {
    const handle = me?.user.username ?? user?.username ?? "";
    if (confirm.trim().toLowerCase() !== handle.toLowerCase()) {
      Alert.alert("Type your username to confirm", `Expected "${handle}".`);
      return;
    }
    Alert.alert(
      "Delete everything?",
      "Your places, trips, journal entries and photos are removed. This cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete my account",
          style: "destructive",
          onPress: async () => {
            setDeleting(true);
            try {
              await api("/api/me", { method: "DELETE" });
              await signOut();
            } catch (e) {
              Alert.alert("Could not delete", e instanceof Error ? e.message : "Try again");
              setDeleting(false);
            }
          },
        },
      ],
    );
  }, [confirm, me, user, signOut]);

  const unread = notes?.unread ?? 0;

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView
        style={{ backgroundColor: palette.background }}
        contentContainerStyle={styles.body}
      >
        <Text style={[styles.name, { color: palette.ink }]}>{user?.name ?? "You"}</Text>

        <Text style={[styles.label, { color: palette.muted }]}>Username</Text>
        <View style={styles.row}>
          <TextInput
            value={username}
            onChangeText={setUsername}
            autoCapitalize="none"
            autoCorrect={false}
            placeholder="yourname"
            placeholderTextColor={palette.muted}
            style={[
              styles.input,
              { flex: 1, backgroundColor: palette.surface, borderColor: palette.border, color: palette.ink },
            ]}
          />
          <Pressable
            onPress={saveProfile}
            disabled={saving}
            style={[styles.save, { backgroundColor: palette.accent }]}
          >
            {saving ? (
              <ActivityIndicator />
            ) : (
              <Text style={{ color: palette.onAccent, fontWeight: "600" }}>Save</Text>
            )}
          </Pressable>
        </View>
        <Text style={[styles.hint, { color: palette.muted }]}>
          Picking one is what gives you a profile others can follow.
        </Text>

        <View style={styles.between}>
          <Text style={[styles.label, { color: palette.muted }]}>Notifications</Text>
          {unread > 0 && (
            <Pressable
              onPress={async () => {
                await api("/api/notifications", { method: "POST" }).catch(() => {});
                reloadNotes();
              }}
            >
              <Text style={{ color: palette.accentText, fontSize: 12 }}>Mark all read</Text>
            </Pressable>
          )}
        </View>

        {(notes?.notifications ?? []).length === 0 ? (
          <Text style={[styles.hint, { color: palette.muted }]}>Nothing yet.</Text>
        ) : (
          <View style={[styles.card, { backgroundColor: palette.surface, borderColor: palette.border }]}>
            {(notes?.notifications ?? []).slice(0, 10).map((n) => (
              <View key={n.id} style={[styles.note, { borderBottomColor: palette.border }]}>
                <Text style={{ color: palette.ink, fontSize: 14 }}>
                  {n.actor?.name ?? n.actor?.username ?? "Someone"}{" "}
                  {n.kind === "follow" ? "followed you" : `copied ${n.tripTitle ?? "your trip"}`}
                </Text>
                <Text style={{ color: palette.muted, fontSize: 12, marginTop: 2 }}>
                  {ago(n.createdAt)}
                  {!n.readAt ? " · new" : ""}
                </Text>
              </View>
            ))}
          </View>
        )}

        <Text style={[styles.label, { color: palette.muted }]}>Privacy</Text>
        <Pressable onPress={() => Linking.openURL(`${API_URL}/privacy`)} style={styles.link}>
          <Text style={{ color: palette.accentText, fontSize: 14 }}>
            What Roava stores and who can see it
          </Text>
        </Pressable>

        <Pressable onPress={signOut} style={[styles.signOut, { borderColor: palette.border }]}>
          <Text style={{ color: palette.ink, fontWeight: "500" }}>Sign out</Text>
        </Pressable>

        <Text style={[styles.danger, { color: "#E07A5F" }]}>Delete account</Text>
        <Text style={[styles.hint, { color: palette.muted }]}>
          Removes your places, trips, journal entries and photos. This cannot be
          undone. Type your username to confirm.
        </Text>
        <View style={styles.row}>
          <TextInput
            value={confirm}
            onChangeText={setConfirm}
            autoCapitalize="none"
            autoCorrect={false}
            placeholder={me?.user.username ?? user?.username ?? "username"}
            placeholderTextColor={palette.muted}
            style={[
              styles.input,
              { flex: 1, backgroundColor: palette.surface, borderColor: palette.border, color: palette.ink },
            ]}
          />
          <Pressable
            onPress={deleteAccount}
            disabled={deleting}
            style={[styles.save, { backgroundColor: "#E07A5F" }]}
          >
            {deleting ? <ActivityIndicator /> : <Text style={{ color: "#fff", fontWeight: "600" }}>Delete</Text>}
          </Pressable>
        </View>

        <View style={{ height: 48 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  body: { padding: 16 },
  name: { fontSize: 22, fontWeight: "600" },
  label: { fontSize: 12, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.5, marginTop: 24, marginBottom: 6 },
  between: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between" },
  row: { flexDirection: "row", gap: 10 },
  input: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15 },
  save: { borderRadius: 10, paddingHorizontal: 18, alignItems: "center", justifyContent: "center" },
  hint: { fontSize: 12, marginTop: 6, lineHeight: 17 },
  card: { borderWidth: 1, borderRadius: 12, overflow: "hidden" },
  note: { paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth },
  link: { paddingVertical: 8 },
  signOut: { marginTop: 24, borderWidth: 1, borderRadius: 10, alignItems: "center", paddingVertical: 12 },
  danger: { fontSize: 12, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.5, marginTop: 36 },
});
