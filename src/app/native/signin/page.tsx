import Image from "next/image";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/user";
import { issueNativeAuthCode } from "@/lib/native-auth";
import { safeNext } from "@/lib/safe-next";

export const dynamic = "force-dynamic";

/// Where the app sends somebody to sign in with anything the website supports.
///
/// The app can do Sign in with Apple on the device and nothing else without a
/// native module it does not have. Rather than add one for each provider, it
/// opens this page: the website signs them in the way it already does, and
/// hands the result back through the app's URL scheme.
///
/// What goes back is a one-time code, never the token. A URL scheme is not a
/// private channel.
export default async function NativeSignInPage({
  searchParams,
}: {
  searchParams: Promise<{ state?: string }>;
}) {
  const { state } = await searchParams;

  // The app always sends one. Without it there is nothing to bind the code to,
  // and this page is not meant to be opened by hand.
  if (!state || state.length < 8 || state.length > 128) {
    redirect("/");
  }

  const user = await getCurrentUser();
  if (!user) {
    // Sign in first, then come back here and finish the handover.
    redirect(
      `/signin?next=${encodeURIComponent(safeNext(`/native/signin?state=${state}`))}`,
    );
  }

  const code = await issueNativeAuthCode(user.id, state);
  const back = `roava://auth?code=${encodeURIComponent(code)}&state=${encodeURIComponent(state)}`;

  // A page rather than a redirect.
  //
  // Safari will not always follow an automatic navigation to a custom scheme —
  // it wants a tap — and a redirect that silently does nothing would leave
  // somebody staring at a blank tab wondering whether they had signed in. So it
  // tries, and says what is happening, and offers the tap if the try was
  // ignored.
  return (
    <div className="flex min-h-full flex-col items-center justify-center gap-4 p-8 text-center">
      <Image src="/brand/mark.png" alt="" width={56} height={56} />
      <div>
        <h1 className="text-lg font-semibold">Signed in</h1>
        <p className="mt-1 text-sm text-muted">Taking you back to Roava…</p>
      </div>

      <a href={back} className="btn btn-primary">
        Open Roava
      </a>

      <p className="max-w-xs text-xs text-muted">
        This link is good for one minute. If nothing happens, tap the button.
      </p>

      <script
        // Attempted immediately for the browsers that allow it; the button is
        // there for the ones that do not.
        dangerouslySetInnerHTML={{
          __html: `window.location.replace(${JSON.stringify(back)});`,
        }}
      />
    </div>
  );
}
