/// Authentication for the iOS app.
///
/// The website signs people in with cookies, which a native app cannot use.
/// Instead the app performs Sign in with Apple on the device, hands us the
/// identity token Apple signed, and gets back a bearer token of our own that
/// it stores in the iOS keychain.
///
/// The two halves of Sign in with Apple — the website's Services ID and the
/// app's bundle ID — resolve to the same Apple `sub` because both name the
/// same primary App ID. That is what lets somebody sign in on their phone and
/// find the trips they added from a laptop.
import { SignJWT, jwtVerify, createRemoteJWKSet } from "jose";
import { prisma } from "@/lib/prisma";

const APPLE_ISSUER = "https://appleid.apple.com";
const APPLE_KEYS = createRemoteJWKSet(
  new URL("https://appleid.apple.com/auth/keys"),
);

/// Distinguishes our app tokens from any other JWT signed with the same
/// secret, so one can never be presented in place of the other.
const TOKEN_TYPE = "roava-native-v1";

/// Long enough that people are not signed out every week, short enough that a
/// stolen phone token is not good forever. Deleting an account invalidates
/// these immediately regardless, because the user row goes with it.
const TOKEN_LIFETIME_DAYS = 60;

function signingKey(): Uint8Array {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET is required to issue app tokens");
  return new TextEncoder().encode(secret);
}

export type AppleIdentity = { sub: string; email: string | null };

/// Verifies the token the device got from Apple. Everything here is a real
/// check against Apple's published keys — the signature, the issuer, and the
/// audience. Skipping the audience check is the classic mistake: it would let
/// a token minted for somebody else's app sign in to this one.
export async function verifyAppleIdentityToken(
  identityToken: string,
): Promise<AppleIdentity | null> {
  const audience = process.env.APPLE_BUNDLE_ID;
  if (!audience) throw new Error("APPLE_BUNDLE_ID is required for app sign-in");

  try {
    const { payload } = await jwtVerify(identityToken, APPLE_KEYS, {
      issuer: APPLE_ISSUER,
      audience,
    });
    if (typeof payload.sub !== "string") return null;
    return {
      sub: payload.sub,
      email: typeof payload.email === "string" ? payload.email : null,
    };
  } catch {
    return null;
  }
}

export async function issueNativeToken(userId: string): Promise<string> {
  return new SignJWT({ typ: TOKEN_TYPE })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime(`${TOKEN_LIFETIME_DAYS}d`)
    .sign(signingKey());
}

/// The user id carried by a bearer token, or null for anything we did not sign
/// or no longer trust.
export async function userIdFromNativeToken(
  token: string,
): Promise<string | null> {
  try {
    const { payload } = await jwtVerify(token, signingKey());
    if (payload.typ !== TOKEN_TYPE) return null;
    return typeof payload.sub === "string" ? payload.sub : null;
  } catch {
    return null;
  }
}

/// Resolves an Apple identity to an account, reusing the one from the website
/// when the same person has signed in there. The Account row is what links
/// them, and it is the same row shape the web provider writes.
export async function userForAppleIdentity(
  identity: AppleIdentity,
  fullName: string | null,
) {
  const existing = await prisma.account.findUnique({
    where: {
      provider_providerAccountId: {
        provider: "apple",
        providerAccountId: identity.sub,
      },
    },
    select: { user: true },
  });
  if (existing) return existing.user;

  // Falling back to email covers the person who signed in with Google on the
  // web using the same address — the same linking the web providers do.
  if (identity.email) {
    const byEmail = await prisma.user.findUnique({
      where: { email: identity.email },
    });
    if (byEmail) {
      await prisma.account.create({
        data: {
          userId: byEmail.id,
          type: "oidc",
          provider: "apple",
          providerAccountId: identity.sub,
        },
      });
      return byEmail;
    }
  }

  return prisma.user.create({
    data: {
      email: identity.email,
      name: fullName,
      accounts: {
        create: {
          type: "oidc",
          provider: "apple",
          providerAccountId: identity.sub,
        },
      },
    },
  });
}
