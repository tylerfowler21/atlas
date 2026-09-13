/// The headers a private image needs to load.
///
/// Anything served from /api is authenticated by a bearer token, but an
/// <Image source={{ uri }}> sends nothing of the sort — it makes its own bare
/// request, gets a 401 and renders an empty box. That is what journal photos
/// have been doing in the app.
///
/// Undefined until the token has been read out of the keychain, which is a
/// tick or two after the first render. Callers MUST hold the <Image> back
/// until then rather than passing undefined headers: the bare request is made
/// immediately, iOS caches its 401 against that URL, and the retry when the
/// headers arrive is served the cached failure. The picture then stays empty
/// for as long as the app is running, which is why a cover would appear right
/// after it was uploaded and be gone the next time the trip was opened.
import { useEffect, useState } from "react";
import { storedToken } from "@/lib/api";

export function useAuthHeaders(): Record<string, string> | undefined {
  const [headers, setHeaders] = useState<Record<string, string> | undefined>();

  useEffect(() => {
    let alive = true;
    void storedToken().then((token) => {
      if (alive && token) setHeaders({ Authorization: `Bearer ${token}` });
    });
    return () => {
      alive = false;
    };
  }, []);

  return headers;
}
