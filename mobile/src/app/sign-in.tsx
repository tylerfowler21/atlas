import * as AppleAuthentication from "expo-apple-authentication";
import { LinearGradient } from "expo-linear-gradient";
import { Image } from "expo-image";
import { SEMANTIC, PAINT } from "@/lib/brand";
import GoogleIcon from "@/components/GoogleIcon";
import { useState } from "react";
import {
  Image as RNImage,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@/lib/auth";
import { useWide } from "@/lib/wide";
import { type } from "@/lib/type";

/// The photograph is a real one of a real place, under a licence that names
/// its author — so the credit at the foot is a condition of using it rather
/// than decoration. The mockups used an AI-generated stand-in and the brief
/// that came with them says not to ship those as photographs of real places.
const CREDIT = "https://commons.wikimedia.org/wiki/File:Oeschinensee_D8A_8808.jpg";

/// The two buttons, drawn once and used by both arrangements.
///
/// They are the screen: everything else is a photograph and a sentence about
/// what the photograph is for. Splitting them out is what lets the iPad have a
/// different shape without having a different sign-in.
function Actions() {
  const { signIn, signInOnTheWeb } = useAuth();
  const [error, setError] = useState<string | null>(null);

  return (
    <>
      {error && <Text style={styles.error}>{error}</Text>}
      <AppleAuthentication.AppleAuthenticationButton
        buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
        // White on the photograph in both appearances: the screen behind it
        // is a dark scrim whatever the phone's setting says.
        buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.WHITE}
        cornerRadius={28}
        style={styles.apple}
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

      {/* Google's own spec: their mark, their wording, and one of their two
          fields. The boards draw this translucent, which is not a style
          Google's terms allow — their dark field is the nearest thing that
          is, and over this scrim it reads much the same. */}
      <Pressable
        style={[styles.google, { backgroundColor: "#131314", borderColor: "#8E918F" }]}
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
        <Text style={[type.button, { color: "#E3E3E3" }]}>Continue with Google</Text>
      </Pressable>

      <Text style={styles.aside}>
        Google opens roava.co to sign in, then comes back here.
      </Text>
    </>
  );
}

export default function SignIn() {
  const insets = useSafeAreaInsets();
  const wide = useWide();

  /// The iPad arrangement, which is the website's: the photograph keeps its
  /// own half, and the buttons sit in a column the width of a phone's rather
  /// than stretched across a thousand points. A sign-in button as wide as a
  /// desk is not a button anybody reads as one.
  if (wide) {
    return (
      <View style={[styles.screen, styles.spread, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 16 }]}>
        <View style={styles.picture}>
          <Image
            source={require("../../assets/images/signin-hero.jpg")}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            cachePolicy="memory-disk"
          />
          <LinearGradient
            colors={["rgba(11,33,28,0.15)", "rgba(11,33,28,0.35)", "rgba(11,33,28,0.92)"]}
            locations={[0, 0.4, 0.82]}
            style={StyleSheet.absoluteFill}
          />
          <View style={styles.pictureFoot}>
            <Text style={styles.headline}>Every place you want to go, on one map.</Text>
            <Text style={styles.blurb}>
              Save spots, plan trips day by day with friends, and keep a map of
              everywhere you&apos;ve been.
            </Text>
            <Text
              style={[styles.credit, { textAlign: "left", marginTop: 0 }]}
              onPress={() => void Linking.openURL(CREDIT)}
              suppressHighlighting
            >
              Oeschinensee, Kandersteg · Orest Svirchevskyi, CC BY-SA 4.0
            </Text>
          </View>
        </View>

        <View style={styles.aside2}>
          <View style={styles.card}>
            <RNImage
              source={require("../../assets/images/icon.png")}
              style={styles.cardMark}
            />
            <Text style={styles.cardTitle}>Sign in to Roava</Text>
            <Text style={styles.cardBlurb}>Pick up where your map left off.</Text>
            <Actions />
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <Image
        source={require("../../assets/images/signin-hero.jpg")}
        style={StyleSheet.absoluteFill}
        contentFit="cover"
        // Decoded before the splash lifts, so the screen never appears empty
        // and then fills in.
        cachePolicy="memory-disk"
      />

      {/* Dark at the foot, where everything that has to be read sits. The
          photograph is at its best at the top, so the scrim stays off it. */}
      <LinearGradient
        colors={["rgba(11,33,28,0.15)", "rgba(11,33,28,0.35)", "rgba(11,33,28,0.92)"]}
        locations={[0, 0.4, 0.82]}
        style={StyleSheet.absoluteFill}
      />

      <View style={[styles.mark, { top: insets.top + 12 }]}>
        <RNImage
          source={require("../../assets/images/icon.png")}
          style={styles.markImage}
        />
        <Text style={styles.wordmark}>Roava</Text>
      </View>

      <View style={[styles.foot, { paddingBottom: insets.bottom + 16 }]}>
        <Text style={styles.headline}>Every place you want to go, on one map.</Text>
        <Text style={styles.blurb}>
          Save spots, plan trips day by day with friends, and keep a map of
          everywhere you&apos;ve been.
        </Text>

        <Actions />

        <Text
          style={styles.credit}
          onPress={() => void Linking.openURL(CREDIT)}
          suppressHighlighting
        >
          Oeschinensee, Kandersteg · Orest Svirchevskyi, CC BY-SA 4.0
        </Text>
      </View>
    </View>
  );
}

/// Fixed colours rather than the palette: everything here sits on a dark
/// photograph, so it is in the photograph's light and not the reader's.
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: PAINT.evergreen950 },
  /// The iPad arrangement: photograph one side, sign-in the other.
  spread: { flexDirection: "row", gap: 24, paddingHorizontal: 24 },
  picture: { flex: 1, borderRadius: 28, overflow: "hidden", justifyContent: "flex-end" },
  pictureFoot: { padding: 28, gap: 10 },
  aside2: { flex: 1, alignItems: "center", justifyContent: "center" },
  card: { width: "100%", maxWidth: 360, alignItems: "stretch" },
  cardMark: { width: 56, height: 56, borderRadius: 14, alignSelf: "center", marginBottom: 16 },
  cardTitle: { ...type.title, fontSize: 28, lineHeight: 32, color: "#fff", textAlign: "center" },
  cardBlurb: {
    ...type.body,
    color: "rgba(255,255,255,0.7)",
    textAlign: "center",
    marginTop: 6,
    marginBottom: 22,
  },
  mark: { position: "absolute", left: 20, flexDirection: "row", alignItems: "center", gap: 10 },
  markImage: { width: 34, height: 34, borderRadius: 9 },
  wordmark: { ...type.item, fontSize: 19, color: "#fff" },
  foot: { marginTop: "auto", paddingHorizontal: 20 },
  headline: { ...type.title, fontSize: 34, lineHeight: 38, color: "#fff" },
  blurb: { ...type.body, color: "rgba(255,255,255,0.78)", marginTop: 10, marginBottom: 22 },
  error: { ...type.meta, color: SEMANTIC.danger, marginBottom: 10 },
  apple: { height: 56 },
  google: {
    minHeight: 56,
    paddingVertical: 10,
    marginTop: 10,
    borderWidth: 1,
    borderRadius: 28,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  aside: { ...type.meta, color: "rgba(255,255,255,0.6)", textAlign: "center", marginTop: 12 },
  credit: {
    ...type.meta,
    fontSize: 11,
    color: "rgba(255,255,255,0.45)",
    textAlign: "center",
    marginTop: 8,
  },
});
