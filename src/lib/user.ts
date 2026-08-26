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

  return {
    id: session.user.id,
    name: session.user.name ?? null,
    email: session.user.email ?? null,
    image: session.user.image ?? null,
  };
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
