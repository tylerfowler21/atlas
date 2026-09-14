/* eslint-disable @next/next/no-img-element -- next/image resamples and
   re-encodes, which is the one thing pixel art cannot survive. These are a
   few kilobytes each and want serving exactly as written. */
/// Otto, drawn — the website's half of the character the app draws.
///
/// The same sprites, and easier here than on a phone: browsers will scale
/// pixel art without smoothing it if asked, so one file covers every screen
/// and there are no @2x and @3x copies to keep. `image-rendering: pixelated`
/// is the whole trick.
///
/// Two families, and they must not meet in one place on screen. A whole figure
/// and a head and shoulders are framed differently, so putting one where the
/// other was makes him change size when he changes mood.

const FIGURE = { width: 80, height: 96 };
const FACE = { width: 64, height: 64 };

const POSES = {
  idle: { file: "otto-idle", ...FIGURE },
  walking: { file: "otto-walking", ...FIGURE },
  searching: { file: "otto-searching", ...FIGURE },
  planning: { file: "otto-planning", ...FIGURE },
  typing: { file: "otto-typing", ...FIGURE },
  pointing: { file: "otto-pointing", ...FIGURE },
  found: { file: "otto-found", ...FIGURE },
  sleeping: { file: "otto-sleeping", ...FIGURE },

  curious: { file: "otto-bust-curious", ...FIGURE },
  focused: { file: "otto-bust-focused", ...FIGURE },
  happy: { file: "otto-bust-happy", ...FIGURE },
  surprised: { file: "otto-bust-surprised", ...FIGURE },
  thinking: { file: "otto-bust-thinking", ...FIGURE },
  celebrating: { file: "otto-bust-celebrating", ...FIGURE },

  avatar: { file: "otto-avatar", ...FACE },
  waving: { file: "otto-avatar-waving", ...FACE },
} as const;

export type OttoPose = keyof typeof POSES;

/// What he is doing, in the words the rest of the app uses, so callers do not
/// have to know which drawing stands for which state. Searching is his
/// thinking pose: the hand-on-chin one is a head and shoulders, and mixing it
/// with the standing poses would have him change size mid-thought.
export const OTTO_FOR = {
  resting: "idle",
  thinking: "searching",
  found: "found",
  /// Nothing yet stands for having looked and found nothing. Curious is the
  /// nearest thing that is not celebrating, and it is a stand-in — the pose
  /// that admits a limit is the one still to be drawn.
  empty: "curious",
} as const satisfies Record<string, OttoPose>;

export default function Otto({
  pose = "idle",
  /// Whether he breathes. Two pixels, slowly, and off under reduce-motion —
  /// the keyframes live in globals.css beside the rest of the motion.
  alive = true,
  className = "",
}: {
  pose?: OttoPose;
  alive?: boolean;
  className?: string;
}) {
  const { file, width, height } = POSES[pose];
  return (
    <img
      src={`/otto/${file}.png`}
      alt=""
      width={width}
      height={height}
      aria-hidden="true"
      className={`otto-pixels ${alive ? "otto-breathes" : ""} ${className}`}
      style={{ width, height }}
    />
  );
}
