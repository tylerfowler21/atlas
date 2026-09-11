import type { Metadata } from "next";
import Image from "next/image";
import { redirect } from "next/navigation";
import { appleConfigured, auth, devLoginEnabled, googleConfigured, signIn } from "@/auth";
import { safeNext } from "@/lib/safe-next";
import GoogleIcon from "@/components/GoogleIcon";

export const metadata: Metadata = { title: "Sign in — Roava" };
export const dynamic = "force-dynamic";

/// Drawn rather than set as emoji: at 14px inside a circle an emoji renders
/// as a muddy few pixels, and 📍 is red on every platform, which fights the
/// evergreen it would be sitting on.
function PinIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden>
      <path d="M12 2a7 7 0 0 0-7 7c0 5.25 7 13 7 13s7-7.75 7-13a7 7 0 0 0-7-7Zm0 9.5A2.5 2.5 0 1 1 12 6.5a2.5 2.5 0 0 1 0 5Z" />
    </svg>
  );
}

function BookmarkIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden>
      <path d="M6.5 3h11a1.5 1.5 0 0 1 1.5 1.5V21l-7-3.5L5 21V4.5A1.5 1.5 0 0 1 6.5 3Z" />
    </svg>
  );
}

/// The photograph beside the sign-in, and the place card floating over it.
///
/// A real photograph of a real place, under a licence that names its author.
/// The mockups used AI-generated stand-ins, and the brief that came with them
/// says not to ship those as photographs of real places — which is exactly
/// what the card beside it does, since it names Oeschinensee and Kandersteg.
/// So the picture is Oeschinensee, and the credit sits at the foot of it.
///
/// Mostly decorative and hidden from screen readers: it says the same thing
/// the headline beside it says, and read aloud it would be furniture between
/// somebody and the button they came for. The credit is the exception — it is
/// a condition of using the photograph, so it stays readable.
///
/// Gone below `lg`. On a phone this panel would push the two buttons under the
/// fold, and a sign-in screen you have to scroll is a worse screen however
/// good the photograph is.
function Hero() {
  return (
    <div className="relative hidden overflow-hidden rounded-[28px] lg:block lg:flex-1">
      <Image
        src="/brand/signin-hero.jpg"
        alt=""
        aria-hidden
        fill
        sizes="(min-width: 1024px) 50vw, 0px"
        className="object-cover"
        priority
      />

      {/* Dark at the foot only, so the headline has something to sit on
          without dulling the light the photograph was chosen for. */}
      <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-black/15" />

      <div aria-hidden className="absolute top-7 left-7 flex items-center gap-2.5">
        <Image src="/brand/mark-64.png" alt="" width={32} height={32} className="rounded-lg" />
        <span className="text-lg font-semibold text-white">Roava</span>
      </div>

      {/* A saved place, mid-air: what the product does, shown rather than
          described. */}
      <div aria-hidden className="absolute top-1/3 right-10 left-10 flex flex-col items-center gap-3">
        <div className="flex w-full max-w-sm items-center gap-3 rounded-full bg-paint-card/85 p-2 pr-3 shadow-lg backdrop-blur-md">
          <Image
            src="/brand/signin-place.jpg"
            alt=""
            width={56}
            height={44}
            className="h-11 w-14 rounded-[14px] object-cover"
          />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-paint-ink">Oeschinen Lake</p>
            <p className="flex items-center gap-1 truncate text-xs text-paint-muted">
              <PinIcon className="size-3 shrink-0 text-paint-nature" />
              Nature · Kandersteg
            </p>
          </div>
          <span className="grid size-9 shrink-0 place-items-center rounded-full bg-paint-sun">
            <BookmarkIcon className="size-4 text-white" />
          </span>
        </div>

        {/* The pin the card belongs to, with Sun tint blooming behind it the
            way a selected pin does on the map itself. */}
        <span className="grid size-12 place-items-center rounded-full bg-paint-sun-tint/60">
          <span className="grid size-9 place-items-center rounded-full border-[3px] border-white bg-paint-evergreen-900">
            <PinIcon className="size-4 text-white" />
          </span>
        </span>
      </div>

      <div aria-hidden className="absolute right-10 bottom-16 left-10">
        <h2 className="text-4xl leading-[1.1] font-bold text-white xl:text-5xl">
          Every place you want to go, on one map.
        </h2>
        <p className="mt-4 max-w-md text-sm text-white/80">
          Save spots, plan trips day by day with friends, and keep a map of
          everywhere you&apos;ve been.
        </p>
      </div>

      {/* CC BY-SA requires the author's name travel with the picture. */}
      <p className="absolute right-10 bottom-6 left-10 text-[11px] text-white/55">
        Oeschinensee, Kandersteg ·{" "}
        <a
          href="https://commons.wikimedia.org/wiki/File:Oeschinensee_D8A_8808.jpg"
          target="_blank"
          rel="noopener noreferrer"
          className="hover:underline"
        >
          Orest Svirchevskyi, CC BY-SA 4.0
        </a>
      </p>
    </div>
  );
}

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; next?: string }>;
}) {
  const { error, next } = await searchParams;

  // Where to land afterwards — the trip somebody was reading when they decided
  // to sign up, so they come back to it rather than to an empty map.
  const destination = safeNext(next);

  const session = await auth();
  if (session?.user) redirect(destination);

  return (
    <div className="flex min-h-full flex-1 gap-0 overflow-auto p-4 lg:gap-8 lg:p-6">
      <Hero />

      <div className="flex flex-1 items-center justify-center lg:flex-1">
        <div className="w-full max-w-sm space-y-6">
          <div className="text-center">
            <Image
              src="/brand/mark.png"
              alt=""
              width={64}
              height={64}
              className="mx-auto rounded-2xl"
              priority
            />
            <h1 className="mt-5 text-3xl">Sign in to Roava</h1>
            <p className="mt-2 text-sm text-muted">Pick up where your map left off.</p>
          </div>

          {error && (
            <p className="card px-3 py-2 text-xs text-[color:var(--danger)]">
              That sign-in didn&apos;t go through. Try again.
            </p>
          )}

          {/* Apple first: it is the one most people arriving from the iOS app
              already have, and the design leads with it. */}
          {appleConfigured && (
            <form
              action={async () => {
                "use server";
                await signIn("apple", { redirectTo: destination });
              }}
            >
              <button
                type="submit"
                className="flex h-12 w-full items-center justify-center rounded-full bg-black text-sm font-medium text-white transition-colors hover:bg-neutral-800 dark:bg-white dark:text-black dark:hover:bg-neutral-200"
              >
                {/* Drawn rather than typed: the  glyph is an Apple-platform
                    font feature and renders as tofu on Android and Windows. */}
                <svg
                  viewBox="0 0 384 512"
                  className="mr-2 h-4 w-4 fill-current"
                  aria-hidden
                >
                  <path d="M318.7 268.7c-.2-36.7 16.4-64.4 50-84.8-18.8-26.9-47.2-41.7-84.7-44.6-35.5-2.8-74.3 20.7-88.5 20.7-15 0-49.4-19.7-76.4-19.7C63.3 141.2 4 184.8 4 273.5q0 39.3 14.4 81.2c12.8 36.7 59 126.7 107.2 125.2 25.2-.6 43-17.9 75.8-17.9 31.8 0 48.3 17.9 76.4 17.9 48.6-.7 90.4-82.5 102.6-119.3-65.2-30.7-61.7-90-61.7-91.9zm-56.6-164.2c27.3-32.4 24.8-61.9 24-72.5-24.1 1.4-52 16.4-67.9 34.9-17.5 19.8-27.8 44.3-25.6 71.9 26.1 2 49.9-11.4 69.5-34.3z" />
                </svg>
                Continue with Apple
              </button>
            </form>
          )}

          {googleConfigured && (
            <form
              action={async () => {
                "use server";
                await signIn("google", { redirectTo: destination });
              }}
            >
              {/* Google's own button spec: their mark, their wording, a white
                  field with a grey border in light and near-black in dark. It
                  looks like every other Google button somebody has ever used,
                  which on a sign-in screen is the entire point. */}
              <button
                type="submit"
                className="flex h-12 w-full items-center justify-center gap-3 rounded-full border border-[#747775] bg-white text-sm font-medium text-[#1F1F1F] transition-colors hover:bg-[#F7F8F8] dark:border-[#8E918F] dark:bg-[#131314] dark:text-[#E3E3E3] dark:hover:bg-[#1B1B1C]"
              >
                <GoogleIcon />
                Continue with Google
              </button>
            </form>
          )}

          <p className="text-center text-xs text-muted">
            By continuing you agree to how Roava handles your data, set out in
            the{" "}
            <a href="/privacy" className="text-accent-text hover:underline">
              Privacy Policy
            </a>
            .
          </p>

          {devLoginEnabled && (
            <form
              className="card space-y-2 p-3"
              action={async (formData: FormData) => {
                "use server";
                await signIn("dev", {
                  email: String(formData.get("email") ?? ""),
                  redirectTo: destination,
                });
              }}
            >
              <p className="text-xs font-medium text-accent-text">Development login</p>
              <p className="text-xs text-muted">
                No password — signs you in as whatever email you type. Local only.
              </p>
              <input
                className="input"
                type="email"
                name="email"
                required
                placeholder="you@example.com"
                aria-label="Email for development login"
              />
              <button type="submit" className="btn btn-ghost w-full justify-center">
                Sign in as this email
              </button>
            </form>
          )}

          {!googleConfigured && !appleConfigured && !devLoginEnabled && (
            <div className="card space-y-2 p-4 text-sm">
              <p className="font-medium">No sign-in method is configured yet.</p>
              <p className="text-xs text-muted">
                Set <code>AUTH_GOOGLE_ID</code> and <code>AUTH_GOOGLE_SECRET</code>{" "}
                (or the matching <code>AUTH_APPLE_</code> pair) in your
                environment. The README walks through creating either client.
              </p>
            </div>
          )}

          <p className="text-center text-xs text-muted">
            Shared itineraries stay readable without an account.
          </p>
        </div>
      </div>
    </div>
  );
}
