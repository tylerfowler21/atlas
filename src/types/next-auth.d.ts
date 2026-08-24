import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      /// Every Atlas row is scoped by this, so it is not optional the way the
      /// default Auth.js session type leaves it.
      id: string;
    } & DefaultSession["user"];
  }
}
