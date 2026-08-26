/// What the deployment's Apple credentials actually contain.
///
/// Apple answering invalid_client means it did not accept the client_id and
/// client_secret pair. Both are set and a direct request with them succeeds, so
/// the useful question is whether they are *exactly* what they should be —
/// stray whitespace from a paste, or a secret minted for a different subject,
/// are invisible to a presence check and fatal to a token exchange.
///
/// Nothing secret is exposed: the Services ID is public, and the JWT's header
/// and payload are metadata that identify which key signed it. The signature is
/// never read or shown.
export type AppleSecretFacts = {
  clientId: string | null;
  /// Quoted so trailing spaces and newlines are visible rather than invisible.
  clientIdQuoted: string | null;
  secretLength: number | null;
  keyId: string | null;
  teamId: string | null;
  subject: string | null;
  audience: string | null;
  expiresAt: string | null;
  /// The subject must equal the client id. Apple rejects the pair otherwise.
  subjectMatchesClientId: boolean | null;
  looksWhitespaceDamaged: boolean;
};

export function inspectAppleSecret(): AppleSecretFacts {
  const rawId = process.env.AUTH_APPLE_ID ?? null;
  const rawSecret = process.env.AUTH_APPLE_SECRET ?? null;
  const clientId = rawId?.trim() ?? null;

  const facts: AppleSecretFacts = {
    clientId,
    clientIdQuoted: rawId === null ? null : JSON.stringify(rawId),
    secretLength: rawSecret?.length ?? null,
    keyId: null,
    teamId: null,
    subject: null,
    audience: null,
    expiresAt: null,
    subjectMatchesClientId: null,
    looksWhitespaceDamaged:
      (rawId !== null && rawId !== rawId.trim()) ||
      (rawSecret !== null && rawSecret !== rawSecret.trim()),
  };

  if (!rawSecret) return facts;

  try {
    const [header, payload] = rawSecret.split(".");
    const decode = (part: string) =>
      JSON.parse(Buffer.from(part, "base64url").toString("utf8"));
    const h = decode(header) as { kid?: string };
    const p = decode(payload) as {
      iss?: string;
      sub?: string;
      aud?: string;
      exp?: number;
    };

    facts.keyId = h.kid ?? null;
    facts.teamId = p.iss ?? null;
    facts.subject = p.sub ?? null;
    facts.audience = p.aud ?? null;
    facts.expiresAt = p.exp ? new Date(p.exp * 1000).toISOString().slice(0, 10) : null;
    facts.subjectMatchesClientId = Boolean(clientId && p.sub === clientId);
  } catch {
    // A secret that will not decode is itself the finding.
  }

  return facts;
}
