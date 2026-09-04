import { redirect } from "next/navigation";

/// Moved to /import, which is what it does. Redirected rather than removed:
/// this address has been linked to.
export default function PasteImportPage() {
  redirect("/import");
}
