import { useCallback, useEffect, useRef, useState } from "react";
import { AppState } from "react-native";
import { useFocusEffect } from "expo-router";
import { ApiError, api } from "@/lib/api";
import { recall, remember } from "@/lib/offline";
import { useAuth } from "@/lib/auth";

/// A GET with the three states every screen here needs to show: loading, an
/// error worth putting on screen, and the data. Signing out on a 401 matters
/// because the alternative is a screen that just fails forever after the
/// account is deleted or the token lapses.
export function useApi<T>(path: string) {
  const { signOut } = useAuth();
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  /// When what is on screen was last true, if it came off the phone rather
  /// than off the network. Null whenever the server answered.
  const [offlineAt, setOfflineAt] = useState<Date | null>(null);
  /// Bumped to ask for a refetch. A counter rather than a boolean so two pulls
  /// in quick succession are two fetches, not one.
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    // Guards against a response landing after the screen is gone, or after a
    // newer request for a different path has already been answered.
    let cancelled = false;

    (async () => {
      try {
        const result = await api<T>(path);
        if (cancelled) return;
        setData(result);
        setError(null);
        setOfflineAt(null);
        remember(path, result);
      } catch (e) {
        if (cancelled) return;
        if (e instanceof ApiError && e.isSignedOut) {
          await signOut();
          return;
        }
        // The last thing the server said, rather than nothing at all. This is
        // the whole point: the moment somebody most needs their itinerary is
        // the moment they are least likely to be able to fetch it.
        const kept = recall<T>(path);
        if (kept) {
          setData(kept.data);
          setError(null);
          setOfflineAt(kept.at);
          return;
        }
        setError(e instanceof Error ? e.message : "Something went wrong");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [path, attempt, signOut]);

  /// Whether this screen has been looked at before. The first focus happens
  /// alongside the mount above, and refetching then would be two requests for
  /// one arrival.
  const seen = useRef(false);

  /// Re-read whenever the screen comes back into view.
  ///
  /// Without this a list is whatever it was when the tab first mounted, and a
  /// tab does not unmount for going out of view. Delete a trip from inside it
  /// and you come back to a list still showing it — which then answers "not
  /// found" when tapped, because the deletion worked perfectly and only the
  /// list had not heard.
  ///
  /// Quietly: no spinner, and a failure leaves what is on screen alone. Stale
  /// data beats an error message over a refresh nobody asked for.
  useFocusEffect(
    useCallback(() => {
      if (!seen.current) {
        seen.current = true;
        return;
      }

      let cancelled = false;
      (async () => {
        try {
          const result = await api<T>(path);
          if (cancelled) return;
          setData(result);
          setError(null);
          setOfflineAt(null);
          remember(path, result);
        } catch (e) {
          // Except a lapsed token, which every screen has to act on.
          if (e instanceof ApiError && e.isSignedOut) {
            await signOut();
            return;
          }
          // What is already on screen stays — but it is now known to be old,
          // and the note says so. Coming back to a tab you opened this morning
          // and being told it is this morning's is the honest version of the
          // stale data that was already here.
          const kept = recall<T>(path);
          if (kept && !cancelled) setOfflineAt(kept.at);
        }
      })();

      return () => {
        cancelled = true;
      };
    }, [path, signOut]),
  );

  /// And again when the app itself comes back.
  ///
  /// Screen focus is a navigation event, so it does not fire for leaving the
  /// app and returning — which is the longer gap of the two, and the one after
  /// which a list is most likely to be wrong.
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (next) => {
      if (next !== "active") return;
      void (async () => {
        try {
          const result = await api<T>(path);
          setData(result);
          setError(null);
          setOfflineAt(null);
          remember(path, result);
        } catch (e) {
          if (e instanceof ApiError && e.isSignedOut) {
            await signOut();
            return;
          }
          const kept = recall<T>(path);
          if (kept) setOfflineAt(kept.at);
        }
      })();
    });
    return () => subscription.remove();
  }, [path, signOut]);

  /// Pull to refresh. Only ever called from a gesture, so showing the spinner
  /// straight away is safe.
  const reload = useCallback(() => {
    setLoading(true);
    setAttempt((n) => n + 1);
  }, []);

  return { data, error, loading, reload, offlineAt };
}
