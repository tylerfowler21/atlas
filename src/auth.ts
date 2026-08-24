import NextAuth, { type NextAuthConfig } from "next-auth";
import Google from "next-auth/providers/google";
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

const providers: NextAuthConfig["providers"] = [];

if (googleConfigured) {
  providers.push(
    Google({
      clientId: process.env.AUTH_GOOGLE_ID,
      clientSecret: process.env.AUTH_GOOGLE_SECRET,
      // Ask for nothing beyond identity.
      authorization: { params: { scope: "openid email profile" } },
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
