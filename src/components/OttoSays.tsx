import Link from "next/link";
import Otto, { type OttoPose } from "@/components/Otto";
import { OTTO_SAYS, type OttoTopic } from "@/lib/otto-says";

/// Otto explaining a screen that has nothing on it yet.
///
/// His quiet register: authored sentences, no model, no allowance, the same
/// words every time. Free to draw and free to read, which is the point —
/// most of a new account is empty screens, and an empty screen with nobody on
/// it is a dead end.
///
/// Deliberately plain beside the offer version. Anything of his that spends a
/// run is a button with its cost written next to it; this is a person standing
/// there saying what the screen is for. If the two looked alike, somebody
/// would tap him for a sentence and be charged for it.

export default function OttoSays({
  topic,
  pose = "idle",
  className = "",
}: {
  topic: OttoTopic;
  /// Pointing suits a screen with somewhere to go; planning suits one that is
  /// about to be built on.
  pose?: OttoPose;
  className?: string;
}) {
  const tip = OTTO_SAYS[topic];
  const go = "go" in tip ? tip.go : undefined;
  const then = "then" in tip ? tip.then : undefined;

  return (
    <div className={`flex items-start gap-3 ${className}`}>
      <Otto pose={pose} />
      <div className="min-w-0 flex-1 pt-1 text-left">
        <p className="text-sm">{tip.says}</p>
        {then && <p className="mt-1.5 text-sm text-muted">{then}</p>}
        {go && (
          <Link
            href={go.href}
            className="mt-2 inline-block text-sm text-accent-text hover:underline"
          >
            {go.label} →
          </Link>
        )}
      </div>
    </div>
  );
}
