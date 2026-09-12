import { useFonts } from "expo-font";
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useColorScheme } from "react-native";
import { AuthProvider, useAuth } from "@/lib/auth";
import { CategoriesProvider } from "@/lib/categories";
import { FONTS } from "@/lib/type";

SplashScreen.preventAutoHideAsync();

function Routes() {
  const { user } = useAuth();
  // The kit's faces. Held behind the splash with the keychain read, because a
  // screen that paints in the system font and then reflows into Bricolage a
  // moment later looks like a bug rather than like loading.
  const [fontsReady] = useFonts(FONTS);

  // Undefined means the keychain has not been read yet. Rendering nothing
  // holds the splash screen rather than showing a sign-in screen to somebody
  // who is already signed in and then yanking it away.
  if (user === undefined || !fontsReady) return null;
  SplashScreen.hideAsync();

  return (
    <Stack screenOptions={{ headerShown: false }}>
      {/* Somebody who has not been through the welcome sees only that: it ends
          by marking them onboarded, which is what lets the tabs render. */}
      <Stack.Protected guard={user !== null && !user.onboarded}>
        <Stack.Screen name="welcome" />
      </Stack.Protected>
      <Stack.Protected guard={user !== null && user.onboarded}>
        <Stack.Screen name="(tabs)" />
        {/* The tabs draw their own chrome, so the stack hides its header by
            default. A screen pushed on top of them needs it back — without a
            header there is no back button, and a trip becomes somewhere you
            can get into and not out of.

            The titles are set here rather than left to expo-router, which
            otherwise names a screen after its file: a trip opened with
            "trip/[id]" in the header and "(tabs)" on the back button. */}
        <Stack.Screen
          name="trip/[id]"
          options={{ headerShown: true, title: "Trip", headerBackTitle: "Trips" }}
        />
        {/* Reached from the avatar on the map rather than from a tab, so it is
            pushed over the tabs and needs the header's way back. */}
        <Stack.Screen
          name="account"
          options={{ headerShown: true, title: "You", headerBackTitle: "Map" }}
        />
      </Stack.Protected>
      <Stack.Protected guard={user === null}>
        <Stack.Screen name="sign-in" />
      </Stack.Protected>
    </Stack>
  );
}

export default function RootLayout() {
  const colorScheme = useColorScheme();
  return (
    <ThemeProvider value={colorScheme === "dark" ? DarkTheme : DefaultTheme}>
      <AuthProvider>
        <CategoriesProvider>
          <Routes />
        </CategoriesProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
