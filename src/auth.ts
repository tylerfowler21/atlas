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
      `[auth] Apple client secret expires ${expiry.toISOString()}. Regenerate it with \`npx auth add apple\` and update AUTH_APPLE_SECRET, or Apple sign-in will start failing.`,
    );
  }

  providers.push(
    Apple({
      clientId: process.env.AUTH_APPLE_ID,
      clientSecret: process.env.AUTH_APPLE_SECRET,
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

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  // JWT sessions rather than database sessions: no database round trip on
  // every request (which matters once this is on serverless), and the
  // credentials provider above only works under this strategy.
  session: { strategy: "jwt" },
  providers,
  pages: { signIn: "/signin" },
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
