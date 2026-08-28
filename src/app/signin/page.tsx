import type { Metadata } from "next";
import Image from "next/image";
import { redirect } from "next/navigation";
import { appleConfigured, auth, devLoginEnabled, googleConfigured, signIn } from "@/auth";
import { safeNext } from "@/lib/safe-next";

export const metadata: Metadata = { title: "Sign in — Roava" };
export const dynamic = "force-dynamic";

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
    <div className="flex min-h-full flex-1 items-center justify-center overflow-auto p-6">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <Image
            src="/brand/mark.png"
            alt=""
            width={72}
            height={72}
            className="mx-auto"
            priority
          />
          <h1 className="mt-2 text-2xl">Roava</h1>
          <p className="mt-1 text-sm text-muted">
            Save the places you want to go, plan trips day by day, and keep a map
            of everywhere you&apos;ve been.
          </p>
        </div>

        {error && (
          <p className="card px-3 py-2 text-xs text-red-500">
            That sign-in didn&apos;t go through. Try again.
          </p>
        )}

        {googleConfigured && (
          <form
            action={async () => {
              "use server";
              await signIn("google", { redirectTo: destination });
            }}
          >
            <button type="submit" className="btn btn-primary w-full justify-center">
              Continue with Google
            </button>
          </form>
        )}

        {appleConfigured && (
          <form
            action={async () => {
              "use server";
              await signIn("apple", { redirectTo: destination });
            }}
          >
            <button
              type="submit"
              className="btn w-full justify-center bg-black text-white hover:bg-neutral-800 dark:bg-white dark:text-black dark:hover:bg-neutral-200"
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
            <p className="text-xs font-medium text-amber-600 dark:text-amber-400">
              Development login
            </p>
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
        <p className="text-center text-xs text-muted">
          <a href="/privacy" className="hover:underline">
            What Roava stores and who can see it
          </a>
        </p>
      </div>
    </div>
  );
}
