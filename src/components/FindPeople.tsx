"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

/// Finding somebody by whatever you happen to know about them.
///
/// This used to assume that what you typed was a username and jump straight
/// to /u/<it>, so typing a person's actual name gave you a 404 — a dead end
/// reached by using the box exactly as it looks like it should be used. It
/// searches now, and the search matches names as well as handles.
///
/// There was a "Browse everyone" button beside it, which stopped being true
/// when the directory stopped listing every account that had picked a
/// username. A button that promises a list nobody will be shown is worse than
/// no button.
export default function FindPeople() {
  const router = useRouter();
  const [query, setQuery] = useState("");

  return (
    <form
      className="flex gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        // The @ is how people write handles and not part of one.
        const asked = query.trim().replace(/^@/, "");
        if (asked) router.push(`/discover?view=people&q=${encodeURIComponent(asked)}`);
      }}
    >
      <input
        className="input"
        placeholder="Find someone by name or username"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      <button type="submit" className="btn btn-ghost shrink-0">
        Go
      </button>
    </form>
  );
}
