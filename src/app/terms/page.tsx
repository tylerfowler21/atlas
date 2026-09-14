import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Terms — Roava" };

const CONTACT = process.env.ADMIN_EMAILS?.split(",")[0]?.trim() ?? "";

/// Outside the (app) group for the same reason the privacy policy is: it has
/// to be readable without an account, and App Store review will fetch it
/// signed out.
///
/// Written in the same voice as the privacy policy rather than in the voice of
/// a legal department. Terms nobody reads protect nobody; the rules here are
/// short enough to actually read, and say what will really happen.
///
/// The section on what is not allowed is not decoration either. An app where
/// people publish things to other people needs to say plainly that there is a
/// line and what happens when somebody crosses it — Apple asks for exactly
/// that before it will approve one, and it is the right thing to have anyway.
export default function TermsPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-6 px-5 py-10 text-sm">
      <div>
        <Link href="/" className="text-xs text-accent-text hover:underline">
          ← Roava
        </Link>
        <h1 className="mt-2 text-xl font-semibold">Terms</h1>
        <p className="mt-1 text-muted">
          Roava is a small personal project, not a company. These are the rules
          for using it, in the same plain terms as the{" "}
          <Link href="/privacy" className="text-accent-text underline">
            privacy policy
          </Link>
          .
        </p>
      </div>

      <section className="space-y-2">
        <h2 className="font-medium">Your account</h2>
        <ul className="list-disc space-y-1 pl-5 text-muted">
          <li>
            You need an account to save anything. Sign in with Google or with
            Apple — Roava never sees your password either way.
          </li>
          <li>
            The account is yours and you are responsible for what happens on it.
            Don&apos;t share it, and don&apos;t sign in as somebody else.
          </li>
          <li>
            You have to be old enough to agree to this where you live. If
            you&apos;re under 13, you can&apos;t use Roava.
          </li>
        </ul>
      </section>

      <section className="space-y-2">
        <h2 className="font-medium">What you put in stays yours</h2>
        <p className="text-muted">
          Your places, trips, journal entries and photographs belong to you.
          Roava claims no ownership of them and will never sell them or use them
          to advertise anything.
        </p>
        <p className="text-muted">
          It needs your permission to do the obvious job: store what you save,
          show it back to you, and show it to the people you deliberately show
          it to — anyone you publish a trip to, anyone holding a share link you
          made, anyone you invite to edit a trip. That permission ends when you
          delete the thing, except for copies other people already made of trips
          you published.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="font-medium">What isn&apos;t allowed</h2>
        <p className="text-muted">
          There is no tolerance for abusive behaviour or for content that has no
          business being here. Don&apos;t publish, share or send:
        </p>
        <ul className="list-disc space-y-1 pl-5 text-muted">
          <li>
            Anything that harasses, threatens, bullies or impersonates somebody,
            or that attacks people for who they are.
          </li>
          <li>
            Anything sexual involving children, anything that sexualises a real
            person who has not agreed to it, and pornography generally.
          </li>
          <li>
            Anything illegal, or anything encouraging somebody else to do
            something illegal or to hurt themselves.
          </li>
          <li>
            Somebody else&apos;s work passed off as yours, or photographs you
            have no right to upload.
          </li>
          <li>
            Private details about other people — their address, their phone
            number — that they did not ask you to publish.
          </li>
          <li>
            Spam, advertising, and anything automated that hammers the service
            or scrapes it.
          </li>
        </ul>
      </section>

      <section className="space-y-2">
        <h2 className="font-medium">Reporting, blocking, and what follows</h2>
        <p className="text-muted">
          Any public profile or published trip can be reported from its page,
          and a shared trip can be reported from the link itself. You can also
          block someone, which hides each of you from the other and removes any
          follows between you — that takes effect immediately and needs nobody&apos;s
          approval.
        </p>
        <p className="text-muted">
          Reports are read and acted on as quickly as one person can manage.
          Anything that breaks the rules above gets taken down, and the account
          behind it can be removed without warning and without getting the
          content back. That judgement is mine to make, and I would rather make
          it quickly than fairly slowly.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="font-medium">Other people&apos;s trips</h2>
        <p className="text-muted">
          A published trip can be read, and copied into your own account to
          change as you like. That copy is for your own planning. Republishing
          somebody else&apos;s itinerary as though you wrote it is the one thing
          copying is not for.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="font-medium">The drafted itineraries</h2>
        <p className="text-muted">
          Roava can draft a trip for you with a language model. It is a draft.
          Every place it suggests is checked against a real map before anything
          is saved, and whatever it invents simply fails to be found — but
          opening hours, prices, whether somewhere still exists and whether it
          is a good idea are all yours to confirm. Don&apos;t book on its word
          alone.
        </p>
        <p className="text-muted">
          There is a limit on how many drafts one account can ask for in a day,
          because each one costs real money to produce.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="font-medium">What isn&apos;t promised</h2>
        <p className="text-muted">
          Roava is offered as it is. It may be unavailable, it may lose data,
          and it may change or stop entirely. There is no backup you can ask to
          be restored from, so keep your own copy of anything you would be upset
          to lose. Nothing here is a guarantee, and nobody is liable for what
          you do with a trip you planned in it.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="font-medium">Ending it</h2>
        <p className="text-muted">
          You can delete your account at any time from{" "}
          <Link href="/settings" className="text-accent-text underline">
            your profile
          </Link>
          , and it takes your places, trips, journal entries and photographs with
          it. It cannot be undone and there is no backup to restore from. Your
          account can also be closed from this end if you break the rules above.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="font-medium">Changes</h2>
        <p className="text-muted">
          These terms can change as Roava does. Carrying on using it after they
          change means accepting the new ones, and anything that genuinely
          matters will be said in the app rather than quietly edited in here.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="font-medium">Getting in touch</h2>
        <p className="text-muted">
          {CONTACT ? (
            <>
              Email <span className="text-foreground">{CONTACT}</span>.
            </>
          ) : (
            "Contact details are configured by whoever runs this instance."
          )}
        </p>
      </section>
    </div>
  );
}
