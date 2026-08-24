import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth, devLoginEnabled, googleConfigured, signIn } from "@/auth";

export const metadata: Metadata = { title: "Sign in — Atlas" };
export const dynamic = "force-dynamic";

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const session = await auth();
  if (session?.user) redirect("/");

  const { error } = await searchParams;

  return (
    <div className="flex min-h-full flex-1 items-center justify-center overflow-auto p-6">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <p className="text-3xl" aria-hidden>
            🧭
          </p>
          <h1 className="mt-2 text-xl font-semibold">Atlas</h1>
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
              await signIn("google", { redirectTo: "/" });
            }}
          >
            <button type="submit" className="btn btn-primary w-full justify-center">
              Continue with Google
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
                redirectTo: "/",
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

        {!googleConfigured && !devLoginEnabled && (
          <div className="card space-y-2 p-4 text-sm">
            <p className="font-medium">No sign-in method is configured yet.</p>
            <p className="text-xs text-muted">
              Set <code>AUTH_GOOGLE_ID</code> and <code>AUTH_GOOGLE_SECRET</code>{" "}
              in your environment to enable Google sign-in. The README walks
              through creating the OAuth client.
            </p>
          </div>
        )}

        <p className="text-center text-xs text-muted">
          Shared itineraries stay readable without an account.
        </p>
      </div>
    </div>
  );
}
