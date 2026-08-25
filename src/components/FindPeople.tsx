"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

/// A shortcut straight to a handle you already know. Browsing everyone lives
/// on /people.
export default function FindPeople() {
  const router = useRouter();
  const [username, setUsername] = useState("");

  return (
    <form
      className="flex gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        const handle = username.trim().toLowerCase().replace(/^@/, "");
        if (handle) router.push(`/u/${encodeURIComponent(handle)}`);
      }}
    >
      <input
        className="input"
        placeholder="Find someone by username — @tyler"
        value={username}
        onChange={(e) => setUsername(e.target.value)}
      />
      <button type="submit" className="btn btn-ghost shrink-0">
        Go
      </button>
      <Link href="/people" className="btn btn-ghost shrink-0">
        Browse everyone
      </Link>
    </form>
  );
}
