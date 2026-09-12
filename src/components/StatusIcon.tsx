import { BeenIcon, LivedIcon, WantToGoIcon } from "@/components/nav-icons";

/// The mark beside a place's status, drawn rather than set as emoji.
///
/// The emoji were 🔖 ✅ 🏠, which meant a green tick from the system font sat
/// beside two Phosphor icons and an evergreen palette, looking like it had
/// wandered in from another application. These take the colour of whatever
/// they sit in, so a chip can tint them.
///
/// The status ids themselves stay in taxonomy.ts, which is shared with the app
/// — the app draws its own and cannot use a React DOM component, so the
/// mapping from id to picture lives here rather than in the shared data.
const ICONS = {
  wishlist: WantToGoIcon,
  visited: BeenIcon,
  lived: LivedIcon,
} as const;

export default function StatusIcon({
  status,
  className = "h-3.5 w-3.5",
}: {
  status: string;
  className?: string;
}) {
  const Icon = ICONS[status as keyof typeof ICONS] ?? WantToGoIcon;
  return <Icon className={className} />;
}
