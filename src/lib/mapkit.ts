/// Tokens for Apple Maps on the web.
///
/// MapKit JS authenticates with a short-lived JWT signed by a key from the
/// Apple developer portal. The key never reaches the browser: the page asks
/// this server for a token, and gets one that expires in half an hour.
///
/// Signing per request rather than shipping one long-lived token matters —
/// Apple will happily issue one valid for a year, and a year-long credential
/// sitting in a public JavaScript bundle is somebody else's free map quota.
import { SignJWT, importPKCS8 } from "jose";

/// What the MapKit key looks like, without revealing it.
///
/// A private key that will not parse makes this endpoint throw, and from
/// outside that is indistinguishable from every other 500. These are the
/// details that identify the usual causes: a value pasted without its header,
/// or with its newlines lost, or truncated.
export function inspectMapkitKey() {
  const raw = process.env.MAPKIT_PRIVATE_KEY ?? null;
  if (!raw) return { present: false as const };
  const pem = raw.replace(/\\n/g, "\n");
  return {
    present: true as const,
    rawLength: raw.length,
    hadEscapedNewlines: raw.includes("\\n"),
    hasRealNewlines: pem.includes("\n"),
    lines: pem.trim().split("\n").length,
    hasHeader: pem.includes("-----BEGIN PRIVATE KEY-----"),
    hasFooter: pem.includes("-----END PRIVATE KEY-----"),
    isQuoted: /^["']|["']$/.test(raw.trim()),
  };
}

export const mapkitConfigured = Boolean(
  process.env.APPLE_TEAM_ID &&
    process.env.MAPKIT_KEY_ID &&
    process.env.MAPKIT_PRIVATE_KEY,
);

const TOKEN_LIFETIME_SECONDS = 30 * 60;

/// Environment variables cannot hold real newlines on most hosts, so the PEM
/// is stored with escaped ones and repaired here.
function privateKeyPem() {
  return (process.env.MAPKIT_PRIVATE_KEY ?? "").replace(/\\n/g, "\n");
}

/// The origin a token should be restricted to.
///
/// Not taken from the request URL: behind a proxy that can be the deployment's
/// own hostname rather than the domain in the browser's address bar, and MapKit
/// requires an exact match — it refuses the token, the map falls back to the
/// free basemap, and nothing says why.
///
/// Not taken from the Host header either, which the caller controls: a request
/// claiming someone else's host would be handed a token scoped to their site,
/// spending this account's quota. The platform's own idea of the production
/// domain is authoritative and cannot be set by a visitor.
export function mapkitOrigin(requestOrigin: string | null): string | null {
  const configured =
    process.env.AUTH_URL ??
    (process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
      : null);

  const origin = configured ?? requestOrigin;
  // Apple rejects a token claiming http://localhost outright, and a
  // development server is already only reachable by its developer.
  return origin?.startsWith("https://") ? origin.replace(/\/$/, "") : null;
}

export async function mapkitToken(origin: string | null): Promise<string> {
  const teamId = process.env.APPLE_TEAM_ID;
  const keyId = process.env.MAPKIT_KEY_ID;
  if (!teamId || !keyId) throw new Error("MapKit is not configured");

  // Restricts the token to pages served from this origin, so one lifted from
  // the network tab cannot power somebody else's site against our quota.
  const restrictable = mapkitOrigin(origin);

  const token = new SignJWT(restrictable ? { origin: restrictable } : {})
    .setProtectedHeader({ alg: "ES256", kid: keyId, typ: "JWT" })
    .setIssuer(teamId)
    .setIssuedAt()
    .setExpirationTime(`${TOKEN_LIFETIME_SECONDS}s`);

  return token.sign(await importPKCS8(privateKeyPem(), "ES256"));
}
