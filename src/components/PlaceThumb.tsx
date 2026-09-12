import Image from "next/image";
import type { CSSProperties } from "react";

/// The square beside a place, wherever a place is listed.
///
/// A photograph when there is one, and the category's own colour with its
/// emoji when there is not — which is most of the time, since photos come from
/// Wikipedia and it has nothing for the bar round the corner.
///
/// One component because the alternative was the same two lines written out in
/// six files, and they had already drifted: the map's list had a coloured tile,
/// every other list had a bare emoji floating in a row, and the same saved
/// place looked like two different things depending on which list you found it
/// in.
export default function PlaceThumb({
  icon,
  color,
  photoUrl,
  alt = "",
  size = 36,
  className = "",
}: {
  icon: string;
  /// The category's colour. `.tile` mixes it with white so the emoji stays
  /// legible on top rather than competing with a saturated square.
  color: string;
  photoUrl?: string | null;
  /// Only meaningful with a photo; a tile is decoration and stays hidden.
  alt?: string;
  size?: number;
  className?: string;
}) {
  if (photoUrl) {
    return (
      <Image
        src={photoUrl}
        alt={alt}
        width={size}
        height={size}
        className={`shrink-0 rounded-[var(--radius-photo)] object-cover ${className}`}
        style={{ width: size, height: size }}
      />
    );
  }

  return (
    <span
      aria-hidden
      className={`tile ${className}`}
      style={
        {
          "--tile-color": color,
          width: size,
          height: size,
          // Half the tile, the same rule the pins follow.
          fontSize: size / 2,
        } as CSSProperties
      }
    >
      {icon}
    </span>
  );
}
