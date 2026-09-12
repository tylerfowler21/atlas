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
  width,
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
  /// Wider than it is tall, for the cards on the map's sheet. Square
  /// everywhere else, which is why this is an option rather than a second
  /// required dimension.
  width?: number;
  className?: string;
}) {
  const w = width ?? size;
  if (photoUrl) {
    return (
      <Image
        src={photoUrl}
        alt={alt}
        width={w}
        height={size}
        className={`shrink-0 rounded-[var(--radius-photo)] object-cover ${className}`}
        style={{ width: w, height: size }}
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
          width: w,
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
