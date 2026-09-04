import * as AppleAuthentication from "expo-apple-authentication";
import GoogleIcon from "@/components/GoogleIcon";
import { useState } from "react";
import { Image, Pressable, StyleSheet, Text, View, useColorScheme } from "react-native";
import { useAuth } from "@/lib/auth";
import { usePalette } from "@/lib/use-palette";

export default function SignIn() {
  const { signIn, signInOnTheWeb } = useAuth();
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

      {/* Apple first, because it is the one that happens on the device and
          because Apple requires it to be offered wherever Google is. */}
      {/* Google's own spec: their mark, their wording, a white field with a
          grey border — and near-black in dark mode. It should look like every
          other Google button anybody has used. */}
      <Pressable
        style={[
          styles.google,
          scheme === "dark"
            ? { backgroundColor: "#131314", borderColor: "#8E918F" }
            : { backgroundColor: "#FFFFFF", borderColor: "#747775" },
        ]}
        onPress={async () => {
          setError(null);
          try {
            await signInOnTheWeb();
          } catch {
            setError("Could not open the sign-in page");
          }
        }}
      >
        <GoogleIcon />
        <Text
          style={{
            color: scheme === "dark" ? "#E3E3E3" : "#1F1F1F",
            fontSize: 16,
            fontWeight: "500",
          }}
        >
          Continue with Google
        </Text>
      </Pressable>

      <Text style={[styles.aside, { color: palette.muted }]}>
        Google opens roava.co to sign in, then comes back here.
      </Text>
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
  google: {
    width: 260,
    height: 48,
    marginTop: 12,
    borderWidth: 1,
    borderRadius: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  aside: { marginTop: 14, fontSize: 12, textAlign: "center" },
});
