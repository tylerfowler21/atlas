import { signOut } from "@/auth";
import { requireUser } from "@/lib/user";
import { isAdmin } from "@/lib/admin";
import NavBar from "@/components/NavBar";

/// Everything the signed-in owner sees. The auth check lives here rather than
/// in each page, so a new page under (app) is private by default; shared
/// itineraries sit outside this group and stay public.
export default async function AppLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const user = await requireUser();

  async function signOutAction() {
    "use server";
    await signOut({ redirectTo: "/signin" });
  }

  return (
    <>
      <NavBar
        user={{ name: user.name, email: user.email, image: user.image }}
        admin={isAdmin(user)}
        signOutAction={signOutAction}
      />
      <main className="min-h-0 flex-1 overflow-auto">{children}</main>
    </>
  );
}
