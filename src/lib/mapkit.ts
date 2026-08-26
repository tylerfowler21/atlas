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

export async function mapkitToken(origin: string | null): Promise<string> {
  const teamId = process.env.APPLE_TEAM_ID;
  const keyId = process.env.MAPKIT_KEY_ID;
  if (!teamId || !keyId) throw new Error("MapKit is not configured");

  const token = new SignJWT({
    // Restricts the token to pages served from this origin, so one lifted from
    // the network tab cannot power somebody else's site against our quota.
    ...(origin ? { origin } : {}),
  })
    .setProtectedHeader({ alg: "ES256", kid: keyId, typ: "JWT" })
    .setIssuer(teamId)
    .setIssuedAt()
    .setExpirationTime(`${TOKEN_LIFETIME_SECONDS}s`);

  return token.sign(await importPKCS8(privateKeyPem(), "ES256"));
}
