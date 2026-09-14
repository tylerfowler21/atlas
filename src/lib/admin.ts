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

/// Whether Otto is around at all.
///
/// His quiet half — standing on an empty screen and saying what it is for —
/// runs no model, spends no allowance and says the same authored sentences
/// every time. There is nothing to ration and nothing to pay for, so he is
/// around for everybody.
// The argument stays although nothing reads it: who somebody is decided this
// once and may again — a paid tier, a beta, an account too new to be offered
// help it has not asked for. Keeping it means that is one edit here rather
// than at every screen he stands on.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function ottoAround(user: Pick<CurrentUser, "email"> | null) {
  return true;
}

/// Whether he may be *asked to work*.
///
/// The half that runs a model and spends somebody's allowance. Deliberately
/// not built on `ottoAround`: the point of the two is that meeting him and
/// being able to spend runs on him are different permissions, and chaining
/// them would have opened the second the day the first opened.
export function ottoOffered(user: Pick<CurrentUser, "email"> | null) {
  return isAdmin(user) && Boolean(process.env["ANTHROPIC_API_KEY"]);
}
