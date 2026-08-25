import { signOut } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/user";
import { isAdmin } from "@/lib/admin";
import { unreadCount } from "@/lib/notifications";
import NavBar from "@/components/NavBar";
import MobileTabBar from "@/components/MobileTabBar";

/// Everything the signed-in owner sees. The auth check lives here rather than
/// in each page, so a new page under (app) is private by default; shared
/// itineraries sit outside this group and stay public.
export default async function AppLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const user = await requireUser();

  // Anyone who has never seen the welcome goes there first — including people
  // who signed up before it existed, who are exactly the ones who could use it.
  const { onboardedAt } = await prisma.user.findUniqueOrThrow({
    where: { id: user.id },
    select: { onboardedAt: true },
  });
  if (!onboardedAt) redirect("/welcome");

  const unread = await unreadCount(user.id);

  async function signOutAction() {
    "use server";
    await signOut({ redirectTo: "/signin" });
  }

  return (
    <>
      <NavBar
        user={{ name: user.name, email: user.email, image: user.image }}
        admin={isAdmin(user)}
        unread={unread}
        signOutAction={signOutAction}
      />
      <main className="min-h-0 flex-1 overflow-auto">{children}</main>
      <MobileTabBar admin={isAdmin(user)} signOutAction={signOutAction} />
    </>
  );
}
