import Image from "next/image";

/// What somebody without an account sees at the bottom of a trip they were
/// sent.
///
/// A shared itinerary is the best introduction the app has: whoever is reading
/// it is already interested in the thing it does, and they got here because
/// somebody they know made one. Until now that ended with the last day of the
/// trip and nothing else — the secret-link page did not mention accounts at
/// all, and the published one offered "Sign in to copy this", which is the
/// wrong verb for somebody who has never been here.
///
/// The sign-in it links to comes back to this page, so agreeing does not cost
/// them the thing they were reading.
export default function SignUpInvite({
  /// Whoever made this trip, so the invitation names them.
  author,
  /// This page's own address, to return to.
  returnTo,
}: {
  author: string | null;
  returnTo: string;
}) {
  return (
    <aside className="border-t border-line px-4 py-5">
      <div className="mx-auto flex max-w-lg flex-col items-center gap-3 text-center">
        <Image src="/brand/mark.png" alt="" width={44} height={44} />

        <div>
          <p className="text-sm font-semibold">
            {author ? `Make your own, like ${author}'s` : "Make your own"}
          </p>
          <p className="mt-1 text-xs text-muted">
            Roava is a map of the places you want to go and the ones
            you&apos;ve been, and trips you can plan day by day. It&apos;s free,
            and everything stays private unless you share it.
          </p>
        </div>

        <a
          href={`/signin?next=${encodeURIComponent(returnTo)}`}
          className="btn btn-primary w-full max-w-xs justify-center"
        >
          Create your account
        </a>

        <p className="text-xs text-muted">
          You&apos;ll come straight back here — and you can save this trip into
          your own account.
        </p>
      </div>
    </aside>
  );
}
