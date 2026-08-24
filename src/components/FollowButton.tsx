"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function FollowButton({
  username,
  initiallyFollowing,
  signedIn,
}: {
  username: string;
  initiallyFollowing: boolean;
  signedIn: boolean;
}) {
  const router = useRouter();
  const [following, setFollowing] = useState(initiallyFollowing);
  const [busy, setBusy] = useState(false);

  if (!signedIn) {
    return (
      <a href="/signin" className="btn btn-primary">
        Sign in to follow
      </a>
    );
  }

  async function toggle() {
    setBusy(true);
    const res = following
      ? await fetch(`/api/follow?username=${encodeURIComponent(username)}`, {
          method: "DELETE",
        })
      : await fetch("/api/follow", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username }),
        });
    setBusy(false);
    if (res.ok) {
      setFollowing(!following);
      router.refresh();
    }
  }

  return (
    <button
      type="button"
      className={following ? "btn btn-ghost" : "btn btn-primary"}
      disabled={busy}
      onClick={toggle}
    >
      {busy ? "…" : following ? "Following" : "Follow"}
    </button>
  );
}
