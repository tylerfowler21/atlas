import Image from "next/image";

/// The directions mark, as supplied rather than redrawn.
///
/// An image rather than an inline SVG, so unlike the navigation icons it does
/// not follow the surrounding text colour — it is a picture with its own
/// palette, which is the point of it.
///
/// Drawn at 22px rather than the 16px the other row controls use: the corner
/// badge is a smudge below about 24, and shrinking artwork until it is
/// unreadable is a worse answer than giving it a little more room.
export default function DirectionsIcon({ size = 22 }: { size?: number }) {
  return (
    <Image
      src="/brand/directions.png"
      alt=""
      width={size}
      height={size}
      className="shrink-0"
    />
  );
}
