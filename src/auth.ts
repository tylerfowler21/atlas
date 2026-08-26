import NextAuth, { type NextAuthConfig } from "next-auth";
import Google from "next-auth/providers/google";
import Apple from "next-auth/providers/apple";
import Credentials from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/prisma";

/// Google is configured only when its credentials are present, so the app
/// still boots (and still serves shared links) before anyone has registered an
/// OAuth client.
export const googleConfigured = Boolean(
  process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET,
);

/// A passwordless local login, for developing multi-user behaviour without
/// Google credentials. Two independent gates, and the production check is on
/// NODE_ENV rather than a variable anyone could set in a dashboard: a built
/// production server will not construct this provider at all.
export const devLoginEnabled =
  process.env.NODE_ENV !== "production" && process.env.ALLOW_DEV_LOGIN === "true";

export const appleConfigured = Boolean(
  process.env.AUTH_APPLE_ID && process.env.AUTH_APPLE_SECRET,
);

/// Apple's client secret is not a password but a JWT that Apple refuses to
/// honour more than six months after it was signed. When it lapses, every
/// Apple sign-in fails at once and nothing in the app changed to explain it,
/// so read the expiry out of the token and say so ahead of time. The payload
/// is only decoded, never verified — we are reading our own secret, and the
/// signature is Apple's business.
export function appleSecretExpiry(): Date | null {
  const secret = process.env.AUTH_APPLE_SECRET;
  if (!secret) return null;
  try {
    const payload = secret.split(".")[1];
    if (!payload) return null;
    const { exp } = JSON.parse(
      Buffer.from(payload, "base64url").toString("utf8"),
    ) as { exp?: number };
    return typeof exp === "number" ? new Date(exp * 1000) : null;
  } catch {
    return null;
  }
}

/// Days until the Apple secret lapses, or null when there is no secret. Lives
/// here rather than in the page because reading the clock during render is
/// impure, and the React Compiler is right to reject it.
export function appleSecretDaysLeft(): number | null {
  const expiry = appleSecretExpiry();
  if (!expiry) return null;
  return Math.round((expiry.getTime() - Date.now()) / 86_400_000);
}

/// What Apple actually puts in the id_token, plus the `user` object it merges
/// in on first consent. Everything is optional because Apple treats all of it
/// as optional.
type AppleProfile = {
  sub: string;
  email?: string | null;
  user?: { name?: { firstName?: string; lastName?: string } };
};

/// Replaces Apple's built-in profile callback, which reads
/// `profile.user.name.firstName` without checking that `name` is there. Apple
/// sends the `user` object only on someone's first authorisation, and omits
/// the name when they decline to share it — so that reads a property of
/// undefined, throws, and Auth.js reports it as "There is a problem with the
/// server configuration", which sends you looking at your credentials rather
/// than at a null check.
export function appleProfile(profile: AppleProfile) {
  const parts = [profile.user?.name?.firstName, profile.user?.name?.lastName];
  const name = parts.filter(Boolean).join(" ");
  return {
    id: profile.sub,
    // Falling back to the email keeps a name on screen; null after that is
    // fine, since the profile page already handles a nameless account.
    name: name || profile.email || null,
    email: profile.email ?? null,
    image: null,
  };
}

const providers: NextAuthConfig["providers"] = [];

if (googleConfigured) {
  providers.push(
    Google({
      clientId: process.env.AUTH_GOOGLE_ID,
      clientSecret: process.env.AUTH_GOOGLE_SECRET,
      // Ask for nothing beyond identity.
      authorization: { params: { scope: "openid email profile" } },
      // The mirror of the Apple provider's linking above, so that arriving via
      // Google second works the same way as arriving via Apple second.
      allowDangerousEmailAccountLinking: true,
    }),
  );
}

if (appleConfigured) {
  const expiry = appleSecretExpiry();
  if (expiry && expiry.getTime() - Date.now() < 14 * 24 * 60 * 60 * 1000) {
    console.warn(
      `[auth] Apple client secret expires ${expiry.toISOString()}. Regenerate it with \`npm run apple:secret\` and update AUTH_APPLE_SECRET, or Apple sign-in will start failing.`,
    );
  }

  providers.push(
    Apple({
      clientId: process.env.AUTH_APPLE_ID,
      clientSecret: process.env.AUTH_APPLE_SECRET,
      profile: appleProfile,
      // Someone who already signed in with Google and then taps "Continue with
      // Apple" is one person, not two. Linking on email alone is only safe
      // because both providers verify the address before asserting it, and
      // neither lets a user set an arbitrary one — hence the alarming name.
      // Note this does not catch Apple's "Hide My Email": that hands us a
      // relay address, which is a genuinely different email and so becomes a
      // genuinely separate account.
      allowDangerousEmailAccountLinking: true,
    }),
  );
}

if (devLoginEnabled) {
  console.warn(
    "[auth] DEV LOGIN IS ENABLED — anyone can sign in as any email. Never set ALLOW_DEV_LOGIN outside local development.",
  );

  providers.push(
    Credentials({
      id: "dev",
      name: "Development login",
      credentials: { email: { label: "Email", type: "email" } },
      async authorize(credentials) {
        const email = String(credentials?.email ?? "").trim().toLowerCase();
        if (!email.includes("@")) return null;

        const user = await prisma.user.upsert({
          where: { email },
          update: {},
          create: { email, name: email.split("@")[0] },
        });
        return { id: user.id, email: user.email, name: user.name, image: user.image };
      },
    }),
  );
}

/// The columns our Account table actually has.
///
/// Auth.js spreads a provider's entire token response into the account it hands
/// the adapter, and @auth/prisma-adapter passes that straight to
/// `account.create`. Anything the provider returns that is not a column makes
/// Prisma throw — and Auth.js reports the failure as "There is a problem with
/// the server configuration", which points at the credentials rather than at
/// an extra field.
///
/// Apple returns `expires_in` alongside the `expires_at` Auth.js derives from
/// it, so linking an Apple account failed every time. Filtering by column name
/// rather than deleting that one field means the next provider with an extra
/// key does not reproduce this.
const ACCOUNT_COLUMNS = new Set([
  "userId",
  "type",
  "provider",
  "providerAccountId",
  "refresh_token",
  "access_token",
  "expires_at",
  "token_type",
  "scope",
  "id_token",
  "session_state",
]);

function adapterWithAccountFilter() {
  const adapter = PrismaAdapter(prisma);
  adapter.linkAccount = (account) =>
    prisma.account.create({
      data: Object.fromEntries(
        Object.entries(account).filter(([key]) => ACCOUNT_COLUMNS.has(key)),
      ) as Parameters<typeof prisma.account.create>[0]["data"],
    }) as never;
  return adapter;
}

/// Keeps the last few sign-in failures where they can be read without access
/// to the host's logs. Best-effort by construction: a diagnostic that can
/// itself throw would replace the error being diagnosed with its own.
async function recordAuthError(error: unknown) {
  try {
    const e = error as { name?: string; message?: string; stack?: string; cause?: unknown };
    // Auth.js wraps the real failure in its own error, so the cause is usually
    // the interesting half.
    const cause = e?.cause as { name?: string; message?: string } | undefined;

    await prisma.authError.create({
      data: {
        kind: [e?.name, cause?.name].filter(Boolean).join(" <- ") || "Unknown",
        message: [e?.message, cause?.message].filter(Boolean).join(" — ").slice(0, 4000),
        stack: e?.stack?.slice(0, 4000) ?? null,
      },
    });

    const stale = await prisma.authError.findMany({
      orderBy: { createdAt: "desc" },
      skip: 10,
      select: { id: true },
    });
    if (stale.length) {
      await prisma.authError.deleteMany({ where: { id: { in: stale.map((r) => r.id) } } });
    }
  } catch {
    // Nothing useful to do; the console line above is still written.
  }
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: adapterWithAccountFilter(),
  // JWT sessions rather than database sessions: no database round trip on
  // every request (which matters once this is on serverless), and the
  // credentials provider above only works under this strategy.
  session: { strategy: "jwt" },
  providers,
  pages: { signIn: "/signin" },
  /// Auth.js reports almost every server-side failure as "Configuration",
  /// which names the wrong suspect. Tagging the real error makes it findable
  /// in the deployment logs instead of guessable.
  logger: {
    error(error) {
      console.error("[auth] sign-in failed:", error);
      void recordAuthError(error);
    },
  },
  callbacks: {
    jwt({ token, user }) {
      // `user` is only present on the request that signs in.
      if (user?.id) token.sub = user.id;
      return token;
    },
    session({ session, token }) {
      if (token.sub) session.user.id = token.sub;
      return session;
    },
  },
});
