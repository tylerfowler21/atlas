/// Asks Apple whether this deployment's MapKit credentials work.
///
/// MapKit only ever says "Unauthorized" in the browser, which covers a key that
/// does not match its key id, a revoked key, a Maps ID that was never
/// associated, and an origin claim that does not match the page. Apple's Maps
/// Server API accepts exactly the same token format and answers properly, so
/// asking it separates the credentials from the origin: if it accepts the
/// token, the key and its id are right and the browser's complaint is about
/// where the page is being served from.
import { SignJWT, importPKCS8 } from "jose";

export type MapkitCheck = { ok: boolean; detail: string };

export async function checkMapkitCredentials(): Promise<MapkitCheck> {
  const teamId = process.env.APPLE_TEAM_ID;
  const keyId = process.env.MAPKIT_KEY_ID;
  const raw = process.env.MAPKIT_PRIVATE_KEY;

  if (!teamId || !keyId || !raw) {
    return { ok: false, detail: "APPLE_TEAM_ID, MAPKIT_KEY_ID or MAPKIT_PRIVATE_KEY is not set." };
  }

  let token: string;
  try {
    // No origin claim: this is about the credentials, and the Maps Server API
    // has no page to compare an origin against.
    token = await new SignJWT({})
      .setProtectedHeader({ alg: "ES256", kid: keyId, typ: "JWT" })
      .setIssuer(teamId)
      .setIssuedAt()
      .setExpirationTime("5m")
      .sign(await importPKCS8(raw.replace(/\\n/g, "\n"), "ES256"));
  } catch (e) {
    return {
      ok: false,
      detail: `The private key will not parse: ${
        e instanceof Error ? e.message : "unknown error"
      }. Delete MAPKIT_PRIVATE_KEY and add it again as a single line with \\n escapes.`,
    };
  }

  try {
    const response = await fetch("https://maps-api.apple.com/v1/token", {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (response.ok) {
      return {
        ok: true,
        detail:
          "Apple accepted this key and key id. If the map still falls back, the token is being refused for its origin rather than its credentials.",
      };
    }
    if (response.status === 401) {
      return {
        ok: false,
        detail:
          "Apple rejected the key. Either MAPKIT_KEY_ID names a different key than MAPKIT_PRIVATE_KEY holds — the Sign in with Apple key and the Maps key are easy to swap — or the key was revoked.",
      };
    }
    return { ok: false, detail: `Apple answered ${response.status}.` };
  } catch {
    return { ok: false, detail: "Could not reach maps-api.apple.com." };
  }
}
