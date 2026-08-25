import { redirect } from "next/navigation";
import { getCurrentUser, type CurrentUser } from "@/lib/user";

/// Who can see the admin page, as a comma-separated list of emails in
/// ADMIN_EMAILS. Deliberately configuration rather than a database flag: it
/// cannot be granted by anything happening inside the app, and with the
/// variable unset — the default — nobody has access at all.
function adminEmails() {
  return (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

export function isAdmin(user: Pick<CurrentUser, "email"> | null) {
  const email = user?.email?.toLowerCase();
  if (!email) return false;
  return adminEmails().includes(email);
}

/// 404 rather than 403 for non-admins, so the page's existence is not
/// advertised to everyone who tries the URL.
export async function requireAdmin() {
  const user = await getCurrentUser();
  if (!user) redirect("/signin");
  if (!isAdmin(user)) redirect("/");
  return user;
}
