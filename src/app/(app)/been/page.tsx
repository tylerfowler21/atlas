import { redirect } from "next/navigation";

/// Everywhere you have been is the map, filtered.
///
/// Redirected rather than removed: this address has been linked to, and a dead
/// link is a worse answer than the page that replaced it.
export default function BeenPage() {
  redirect("/?status=visited");
}
