import type { ColorValue } from "react-native";
import { BeenIcon, LivedIcon, WantToGoIcon } from "@/components/nav-icons";

/// The mark for a place's status, drawn rather than set as emoji — the same
/// three the website uses, from the same source SVGs.
const ICONS = {
  wishlist: WantToGoIcon,
  visited: BeenIcon,
  lived: LivedIcon,
} as const;

export default function StatusIcon({
  status,
  size = 16,
  color,
}: {
  status: string;
  size?: number;
  color?: ColorValue;
}) {
  const Icon = ICONS[status as keyof typeof ICONS] ?? WantToGoIcon;
  return <Icon size={size} color={color} />;
}
