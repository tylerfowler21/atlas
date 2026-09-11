/// A trip's paperwork on the phone: hotel confirmations, tickets, whatever was
/// emailed over.
///
/// Two shapes, one component, matching the website: attached to the stop it
/// confirms, and gathered on the trip's own Files tab.
///
/// A confirmation arrives as a PDF or as a screenshot of one, so both are
/// offered: the document picker for what the hotel emailed, the photo library
/// for what somebody screenshotted.
import { useState } from "react";
import * as DocumentPicker from "expo-document-picker";
import * as ImagePicker from "expo-image-picker";
import {
  ActionSheetIOS,
  Alert,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { API_URL, upload, api, type TripDocument } from "@/lib/api";
import {
  ALLOWED_DOCUMENT_TYPES,
  documentIcon,
  formatBytes,
  MAX_DOCUMENT_BYTES,
} from "@/lib/trip-documents";
import { usePalette } from "@/lib/use-palette";

async function pickDocument() {
  const result = await DocumentPicker.getDocumentAsync({
    // The same list the server accepts, so a file is turned away in the picker
    // rather than after it has been chosen and uploaded.
    type: [...ALLOWED_DOCUMENT_TYPES.keys()],
    copyToCacheDirectory: true,
  });
  const file = result.assets?.[0];
  if (result.canceled || !file) return null;
  return {
    uri: file.uri,
    name: file.name || "Document",
    type: file.mimeType || "application/octet-stream",
    size: file.size ?? 0,
  };
}

async function pickPhoto() {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) {
    Alert.alert("Photos aren't shared", "Allow photo access for Roava in Settings to attach one.");
    return null;
  }
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ["images"],
    quality: 0.85,
  });
  const asset = result.assets?.[0];
  if (result.canceled || !asset) return null;
  return {
    uri: asset.uri,
    name: asset.fileName ?? "Photo.jpg",
    type: asset.mimeType ?? "image/jpeg",
    size: asset.fileSize ?? 0,
  };
}

export default function TripFiles({
  tripId,
  files,
  itemId = null,
  onChanged,
}: {
  tripId: string;
  files: TripDocument[];
  /// Set to show only this stop's files and attach anything added here to it.
  itemId?: string | null;
  onChanged: () => void;
}) {
  const palette = usePalette();
  const [busy, setBusy] = useState(false);

  const shown = itemId === null ? files : files.filter((f) => f.itemId === itemId);
  const compact = itemId !== null;

  async function send(picked: { uri: string; name: string; type: string; size: number }) {
    if (picked.size > MAX_DOCUMENT_BYTES) {
      Alert.alert("Too big", `${picked.name} is larger than ${formatBytes(MAX_DOCUMENT_BYTES)}.`);
      return;
    }
    setBusy(true);
    try {
      const form = new FormData();
      // React Native's FormData takes this shape for a file rather than a Blob.
      form.append("file", {
        uri: picked.uri,
        name: picked.name,
        type: picked.type,
      } as unknown as Blob);
      if (itemId) form.append("itemId", itemId);
      await upload(`/api/trips/${tripId}/documents`, form);
      onChanged();
    } catch (e) {
      Alert.alert("Could not upload that", e instanceof Error ? e.message : "Try again");
    } finally {
      setBusy(false);
    }
  }

  function add() {
    ActionSheetIOS.showActionSheetWithOptions(
      {
        title: "Attach a file",
        options: ["Cancel", "Photo or screenshot", "PDF or document"],
        cancelButtonIndex: 0,
      },
      async (chosen) => {
        if (chosen === 1) {
          const picked = await pickPhoto();
          if (picked) await send(picked);
        }
        if (chosen === 2) {
          const picked = await pickDocument();
          if (picked) await send(picked);
        }
      },
    );
  }

  function remove(file: TripDocument) {
    Alert.alert(`Remove ${file.name}?`, undefined, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: async () => {
          try {
            await api(`/api/documents/${file.id}`, { method: "DELETE" });
            onChanged();
          } catch (e) {
            Alert.alert("Could not remove that", e instanceof Error ? e.message : "Try again");
          }
        },
      },
    ]);
  }

  return (
    <View style={compact ? undefined : styles.body}>
      {shown.length === 0 && !compact && (
        <Text style={{ color: palette.muted, fontSize: 13, lineHeight: 19 }}>
          Hotel confirmations, tickets, anything you were emailed. Everyone this
          trip is shared with can read them.
        </Text>
      )}

      {shown.map((file) => (
        <View
          key={file.id}
          style={[
            compact ? styles.rowCompact : styles.row,
            { borderColor: palette.border, backgroundColor: palette.surface },
          ]}
        >
          <Text style={{ fontSize: 15 }}>{documentIcon(file.contentType)}</Text>
          <Pressable
            style={{ flex: 1 }}
            onPress={() => {
              // Opened in Safari, which is the only thing on the phone that
              // reliably renders a PDF — and the one place the session cannot
              // follow. Said plainly rather than showing a blank page.
              Alert.alert(
                file.name,
                "Files open on the website, where you are signed in. Opening it there now.",
                [
                  { text: "Cancel", style: "cancel" },
                  {
                    text: "Open",
                    onPress: () => void Linking.openURL(`${API_URL}/api/documents/${file.id}`),
                  },
                ],
              );
            }}
          >
            <Text style={{ color: palette.accentText, fontSize: 14 }} numberOfLines={1}>
              {file.name}
            </Text>
            {!compact && (
              <Text style={{ color: palette.muted, fontSize: 12 }}>
                {formatBytes(file.size)}
              </Text>
            )}
          </Pressable>
          <Pressable onPress={() => remove(file)} hitSlop={8}>
            <Text style={{ color: palette.muted, fontSize: 18 }}>×</Text>
          </Pressable>
        </View>
      ))}

      <Pressable onPress={add} disabled={busy} style={compact ? styles.addCompact : styles.add}>
        <Text style={{ color: palette.accentText, fontSize: compact ? 13 : 14 }}>
          {busy ? "Uploading…" : "📎 Attach a file"}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  body: { paddingHorizontal: 16, paddingBottom: 24 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    borderWidth: 1,
    borderRadius: 10,
    padding: 11,
    marginBottom: 8,
  },
  rowCompact: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 9,
    paddingVertical: 7,
    marginTop: 6,
  },
  add: { paddingVertical: 10 },
  addCompact: { paddingVertical: 8 },
});
