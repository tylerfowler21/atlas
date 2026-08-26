import * as AppleAuthentication from "expo-apple-authentication";
import { useState } from "react";
import { Image, StyleSheet, Text, View, useColorScheme } from "react-native";
import { useAuth } from "@/lib/auth";
import { usePalette } from "@/lib/use-palette";

export default function SignIn() {
  const { signIn } = useAuth();
  const scheme = useColorScheme();
  const palette = usePalette();
  const [error, setError] = useState<string | null>(null);

  return (
    <View style={[styles.screen, { backgroundColor: palette.background }]}>
      <Image
        source={require("../../assets/images/icon.png")}
        style={styles.mark}
      />
      <Text style={[styles.title, { color: palette.ink }]}>Roava</Text>
      <Text style={[styles.blurb, { color: palette.muted }]}>
        The places you want to go, the trips you take, and a map of everywhere
        you have been.
      </Text>

      {error && <Text style={styles.error}>{error}</Text>}

      <AppleAuthentication.AppleAuthenticationButton
        buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
        buttonStyle={
          scheme === "dark"
            ? AppleAuthentication.AppleAuthenticationButtonStyle.WHITE
            : AppleAuthentication.AppleAuthenticationButtonStyle.BLACK
        }
        cornerRadius={10}
        style={styles.button}
        onPress={async () => {
          setError(null);
          try {
            await signIn();
          } catch (e) {
            // Cancelling is not a failure and should not be reported as one.
            if ((e as { code?: string }).code === "ERR_REQUEST_CANCELED") return;
            setError(e instanceof Error ? e.message : "That didn't work");
          }
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, alignItems: "center", justifyContent: "center", padding: 32 },
  mark: { width: 76, height: 76, borderRadius: 18 },
  title: { fontSize: 28, fontWeight: "600", marginTop: 12 },
  blurb: { marginTop: 8, marginBottom: 28, textAlign: "center", lineHeight: 20 },
  error: { color: "#ef4444", marginBottom: 12, textAlign: "center" },
  button: { width: 260, height: 48 },
});
