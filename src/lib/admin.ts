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

/// Whether to offer Otto at all.
///
/// Two conditions and one place to change them: the person is on the admin
/// list while he is being tried out, and the server has a model to run him
/// with. Kept here rather than in each screen that draws him, so releasing
/// him is one edit instead of a search.
export function ottoOffered(user: Pick<CurrentUser, "email"> | null) {
  return isAdmin(user) && Boolean(process.env["ANTHROPIC_API_KEY"]);
}
