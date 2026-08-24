"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

/// There is no directory to browse — you follow people whose handle you know,
/// which is the whole discovery model.
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
    </form>
  );
}
