import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { userIdFromNativeToken } from "@/lib/native-auth";

export type CurrentUser = {
  id: string;
  name: string | null;
  email: string | null;
  image: string | null;
};

/// The signed-in user, or null. Every query in the app scopes by `id`, so this
/// returning null is what keeps one person's places out of another's.
export async function getCurrentUser(): Promise<CurrentUser | null> {
  // The iOS app has no cookies, so it presents a bearer token instead. Doing
  // this here rather than in each route means every endpoint the website
  // already has works from the phone without being touched.
  const bearer = await bearerUser();
  if (bearer) return bearer;

  const session = await auth();
  if (!session?.user?.id) return null;

  // Confirmed against the database rather than taken from the token.
  //
  // A session cookie is a signed claim about who somebody was when they signed
  // in, and it stays valid for weeks after the account it names has gone. Every
  // page then asks for that user, does not find them, and throws — a server
  // error on every screen, including the sign-in page you would use to get out
  // of it. Deleting your account on one device did this to every other one.
  //
  // The bearer path below already reads the database for exactly this reason.
  // This is the same read, on an indexed primary key, so the two agree about
  // what a deleted account means.
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, name: true, email: true, image: true },
  });
  return user ?? null;
}

/// Looks up the user named by an `Authorization: Bearer` token. The database
/// read is deliberate: it means deleting an account invalidates that account's
/// app tokens immediately, without anything having to track them.
async function bearerUser(): Promise<CurrentUser | null> {
  const header = (await headers()).get("authorization");
  if (!header?.toLowerCase().startsWith("bearer ")) return null;

  const userId = await userIdFromNativeToken(header.slice(7).trim());
  if (!userId) return null;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, email: true, image: true },
  });
  return user ?? null;
}

/// For pages: send anyone who isn't signed in to the sign-in screen.
export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/signin");
  return user;
}
