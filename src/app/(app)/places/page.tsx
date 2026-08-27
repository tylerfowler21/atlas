import { redirect } from "next/navigation";

/// The map carries the places list and the same filters.
///
/// Redirected rather than removed: this address has been linked to, and a dead
/// link is a worse answer than the page that replaced it.
export default function PlacesPage() {
  redirect("/");
}
