/// Who else can edit this trip.
///
/// The website has had this since trips could be shared; the app could open a
/// trip somebody had invited you to but never say who else was on it, and
/// never let you invite anyone. So a trip planned together had to be set up at
/// a laptop before it could be used on a phone, which is the wrong way round —
/// the phone is where you are when you remember to add someone.
///
/// An invitation is addressed to an email rather than to an account, so you
/// can invite somebody who has not signed up yet; it binds to them when they
/// first open the trip. Until then they show as invited rather than as here.
import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Keyboard,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { api } from "@/lib/api";
import { RADIUS, SEMANTIC } from "@/lib/brand";
import { type } from "@/lib/type";
import { useApi } from "@/lib/use-api";
import { usePalette } from "@/lib/use-palette";

type Collaborator = {
  email: string;
  role: string;
  accepted: boolean;
  name: string | null;
  image: string | null;
};

type Owner = { name: string | null; username: string | null; image: string | null } | null;
type People = { role: string; owner: Owner; collaborators: Collaborator[] };

/// Enough of an address to be worth sending to. The server checks it properly;
/// this only decides whether the button is worth offering.
function looksLikeEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

export default function TripPeople({ tripId }: { tripId: string }) {
  const palette = usePalette();
  // The same hook every other screen reads through: it cancels a response that
  // lands after this is gone, and signs out on a lapsed token rather than
  // failing forever.
  const { data: people, loading, error, reload } = useApi<People>(
    `/api/trips/${tripId}/collaborators`,
  );
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);

  const isOwner = people?.role === "owner";
  /// The owner is not a collaborator row — they are the trip — but a list of
  /// who can edit that leaves them out is a strange list.
  const ownerLabel =
    people?.owner?.name ??
    (people?.owner?.username ? `@${people.owner.username}` : null) ??
    (isOwner ? "You" : "The owner");

  async function invite() {
    const address = email.trim().toLowerCase();
    if (!looksLikeEmail(address)) {
      Alert.alert("Check that address", "It needs to look like an email address.");
      return;
    }
    setBusy(true);
    Keyboard.dismiss();
    try {
      const body = await api<{ emailed?: boolean }>(
        `/api/trips/${tripId}/collaborators`,
        { method: "POST", body: JSON.stringify({ email: address }) },
      );
      setEmail("");
      reload();
      // The invitation is recorded either way. Whether the email actually went
      // is a separate question, and one they need answering — otherwise they
      // wait for a reply to a message nobody received.
      if (body.emailed === false) {
        Alert.alert(
          "Invited, but no email went out",
          `${address} can open the trip once they sign in, but you'll have to tell them yourself.`,
        );
      }
    } catch (e) {
      Alert.alert("Could not invite them", e instanceof Error ? e.message : "Try again");
    } finally {
      setBusy(false);
    }
  }

  function remove(person: Collaborator) {
    const name = person.name ?? person.email;
    Alert.alert(
      `Remove ${name}?`,
      "They lose access to this trip. Nothing they added to it is removed.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: async () => {
            setBusy(true);
            try {
              await api(
                `/api/trips/${tripId}/collaborators?email=${encodeURIComponent(person.email)}`,
                { method: "DELETE" },
              );
              reload();
            } catch (e) {
              Alert.alert("Could not remove them", e instanceof Error ? e.message : "Try again");
            } finally {
              setBusy(false);
            }
          },
        },
      ],
    );
  }

  if (loading && !people) return <ActivityIndicator style={{ marginTop: 12 }} />;
  // A trip you can open always has an answer here. If it somehow does not,
  // a red line above the itinerary helps nobody — the section just stays away.
  if (error || !people) return null;

  return (
    <>
      <Text style={[styles.label, { color: palette.muted }]}>Who can edit this</Text>

      <View style={[styles.row, { borderColor: palette.border, backgroundColor: palette.surface }]}>
        {people.owner?.image ? (
          <Image source={{ uri: people.owner.image }} style={styles.avatar} />
        ) : (
          <View style={[styles.avatar, { backgroundColor: palette.border }]}>
            <Text style={{ color: palette.ink, fontSize: 13, fontWeight: "600" }}>
              {ownerLabel.replace("@", "").charAt(0).toUpperCase()}
            </Text>
          </View>
        )}
        <View style={{ flex: 1 }}>
          <Text style={[type.item, { color: palette.ink }]} numberOfLines={1}>
            {ownerLabel}
          </Text>
          <Text style={[type.meta, { color: palette.muted }]}>
            {isOwner ? "Owner — you" : "Owner"}
          </Text>
        </View>
      </View>

      {people.collaborators.map((person) => (
        <View
          key={person.email}
          style={[styles.row, { borderColor: palette.border, backgroundColor: palette.surface }]}
        >
          {person.image ? (
            <Image source={{ uri: person.image }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, { backgroundColor: palette.border }]}>
              <Text style={{ color: palette.ink, fontSize: 13, fontWeight: "600" }}>
                {(person.name ?? person.email).charAt(0).toUpperCase()}
              </Text>
            </View>
          )}
          <View style={{ flex: 1 }}>
            <Text style={[type.item, { color: palette.ink }]} numberOfLines={1}>
              {person.name ?? person.email}
            </Text>
            <Text style={[type.meta, { color: palette.muted }]} numberOfLines={1}>
              {person.accepted ? "Can edit" : "Invited — hasn't opened it yet"}
            </Text>
          </View>
          {/* The owner can remove anyone; anybody else may only let themselves
              out, and the server enforces that rather than trusting this. */}
          {isOwner && (
            <Pressable onPress={() => remove(person)} disabled={busy} hitSlop={8}>
              <Text style={{ color: SEMANTIC.danger, fontSize: 13 }}>Remove</Text>
            </Pressable>
          )}
        </View>
      ))}

      {isOwner && (
        <>
          <View style={styles.invite}>
            <TextInput
              value={email}
              onChangeText={setEmail}
              placeholder="their@email.com"
              placeholderTextColor={palette.muted}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              onSubmitEditing={() => void invite()}
              returnKeyType="send"
              style={[
                styles.input,
                { borderColor: palette.border, backgroundColor: palette.surface, color: palette.ink },
              ]}
            />
            <Pressable
              onPress={() => void invite()}
              disabled={busy || !looksLikeEmail(email)}
              style={[
                styles.send,
                {
                  backgroundColor: looksLikeEmail(email) ? palette.primary : palette.border,
                },
              ]}
            >
              <Text
                style={{
                  color: looksLikeEmail(email) ? palette.onPrimary : palette.muted,
                  fontWeight: "600",
                  fontSize: 14,
                }}
              >
                Invite
              </Text>
            </Pressable>
          </View>
          {/* The rest of this sheet waits for Save; this does not. Inviting
              somebody sends them an email the moment it is tapped, and Cancel
              cannot call it back, so the field says so rather than letting
              anybody find out afterwards. */}
          <Text style={[type.meta, { color: palette.muted }]}>
            They can add stops, times and notes. They cannot publish it, share
            it or delete it — that stays with you. Invitations go out as soon as
            you tap Invite, not when you save.
          </Text>
        </>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  label: { fontSize: 12, marginTop: 18, marginBottom: 6, textTransform: "uppercase" },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderWidth: 1,
    borderRadius: RADIUS.card,
    padding: 12,
    marginBottom: 8,
  },
  avatar: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  invite: { flexDirection: "row", gap: 8, alignItems: "center" },
  input: {
    flex: 1,
    borderWidth: 1,
    borderRadius: RADIUS.card,
    paddingHorizontal: 12,
    paddingVertical: 11,
    fontSize: 15,
  },
  send: { borderRadius: 999, paddingHorizontal: 18, paddingVertical: 11 },
});
