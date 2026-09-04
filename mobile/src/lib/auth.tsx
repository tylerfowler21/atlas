/// Sign in with Apple on the device, exchanged for the app's own token.
import * as AppleAuthentication from "expo-apple-authentication";
import { Alert, Linking } from "react-native";
import { useRef , createContext, use, useCallback, useEffect, useState } from "react";
import { API_URL, clearToken, storeToken, storedToken } from "@/lib/api";

import type { Me } from "@/lib/api";
export type { Me };

type AuthState = {
  /// Undefined while the keychain is still being read, so the UI can wait
  /// rather than flashing the sign-in screen at somebody already signed in.
  user: Me | null | undefined;
  signIn: () => Promise<void>;
  /// Signing in with anything the website supports — Google today.
  ///
  /// The app cannot talk to Google itself without a native module it does not
  /// have, so it opens the website, which already can, and the website hands
  /// back a one-time code through the app's URL scheme. Nothing here is
  /// provider-specific: whatever the website learns to sign in with, the app
  /// gets for free.
  signInOnTheWeb: () => Promise<void>;
  signOut: () => Promise<void>;
  /// Applies a change made elsewhere — finishing the welcome, picking a
  /// username — without a round trip, so the screen it unlocks appears at once.
  updateUser: (patch: Partial<Me>) => void;
};

const AuthContext = createContext<AuthState | null>(null);

export function useAuth() {
  const value = use(AuthContext);
  if (!value) throw new Error("useAuth used outside AuthProvider");
  return value;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<Me | null | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const token = await storedToken();
      if (cancelled) return;
      if (!token) {
        setUser(null);
        return;
      }
      // A stored token proves nothing on its own — it may have expired, or the
      // account may have been deleted from the website since.
      try {
        const me = await fetch(`${API_URL}/api/me`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (cancelled) return;
        if (me.ok) {
          const body = await me.json();
          setUser(body.user ?? null);
        } else {
          await clearToken();
          setUser(null);
        }
      } catch {
        if (!cancelled) setUser(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const signIn = useCallback(async () => {
    // Checked before Apple is invoked: otherwise someone completes Face ID,
    // waits, and gets a generic failure — when the app simply had nowhere to
    // send the result.
    if (!API_URL) {
      throw new Error(
        "This build has no API address (EXPO_PUBLIC_API_URL). Under `expo start` it comes from mobile/.env.",
      );
    }

    const credential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
    });
    if (!credential.identityToken) throw new Error("Apple returned no identity token");

    // Apple gives the name exactly once, on first consent, and never again —
    // so it has to be forwarded now or it is lost for good.
    const fullName = [credential.fullName?.givenName, credential.fullName?.familyName]
      .filter(Boolean)
      .join(" ");

    const response = await fetch(`${API_URL}/api/auth/native`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        identityToken: credential.identityToken,
        fullName: fullName || undefined,
      }),
    });
    if (!response.ok) throw new Error("That sign-in didn't go through");

    const body = await response.json();
    await storeToken(body.token);
    setUser(body.user);
  }, []);

  /// Ties a code arriving on the URL scheme back to the attempt that asked for
  /// it. Random per attempt, and required again when the code is redeemed, so a
  /// code cannot be handed to an app that never started a sign-in.
  const pendingState = useRef<string | null>(null);

  const signInOnTheWeb = useCallback(async () => {
    const state = `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}${Math.random().toString(36).slice(2)}`;
    pendingState.current = state;
    await Linking.openURL(`${API_URL}/native/signin?state=${encodeURIComponent(state)}`);
  }, []);

  // The other half: the website finishes and sends the app a code.
  useEffect(() => {
    async function redeem(url: string) {
      // Parsed by hand rather than with a URL parser: this is a custom scheme,
      // and the platform's URL support treats "roava://auth?x=1" inconsistently
      // enough that a regex over the query string is the more predictable
      // reading of it.
      if (!url.startsWith("roava://auth")) return;
      const query = url.slice(url.indexOf("?") + 1);
      const value = (key: string) =>
        query
          .split("&")
          .map((pair) => pair.split("="))
          .find(([k]) => k === key)?.[1];

      const code = value("code") ? decodeURIComponent(value("code")!) : null;
      const state = value("state") ? decodeURIComponent(value("state")!) : null;
      if (!code || !state) return;
      // Not ours: either stale, or somebody else's idea of what should happen.
      if (state !== pendingState.current) return;
      pendingState.current = null;

      try {
        const response = await fetch(`${API_URL}/api/auth/native/exchange`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code, state }),
        });
        if (!response.ok) throw new Error("expired");
        const body = await response.json();
        await storeToken(body.token);
        setUser(body.user);
      } catch {
        Alert.alert(
          "That sign-in didn't finish",
          "The link timed out. Try again — it only stays valid for a minute.",
        );
      }
    }

    const subscription = Linking.addEventListener("url", ({ url }) => void redeem(url));
    // The app can also be launched cold by the link rather than resumed.
    Linking.getInitialURL().then((url) => {
      if (url) void redeem(url);
    });

    return () => subscription.remove();
  }, []);

  const signOut = useCallback(async () => {
    await clearToken();
    setUser(null);
  }, []);

  const updateUser = useCallback((patch: Partial<Me>) => {
    setUser((current) => (current ? { ...current, ...patch } : current));
  }, []);

  return (
    <AuthContext value={{ user, signIn, signInOnTheWeb, signOut, updateUser }}>
      {children}
    </AuthContext>
  );
}
