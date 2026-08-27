import { redirect } from "next/navigation";

/// Feed and People became one page.
///
/// Redirected rather than removed: this address has been linked to, and a dead
/// link is a worse answer than the page that replaced it.
export default function PeoplePage() {
  redirect("/discover?view=people");
}
