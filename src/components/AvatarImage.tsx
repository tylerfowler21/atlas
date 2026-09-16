"use client";

import { useState } from "react";

/// A profile picture that knows how to stop being one.
///
/// Avatars are URLs handed over by an identity provider at sign-up and never
/// looked at again. Google's expire when somebody changes their photo, and
/// every one of these call sites already had a perfectly good initials circle
/// for the case where there is no picture at all — and used it only for null,
/// so a URL that had stopped working showed a broken-image icon for ever
/// instead.
///
/// The fallback is passed in rather than drawn here, because each place wants
/// its own: different sizes, different rings, and one that colours itself by
/// whether the invitation was accepted.
export default function AvatarImage({
  src,
  fallback,
  alt = "",
  title,
  size,
  className,
}: {
  src: string | null;
  fallback: React.ReactNode;
  alt?: string;
  title?: string;
  size: number;
  className?: string;
}) {
  const [broken, setBroken] = useState(false);

  if (!src || broken) return <>{fallback}</>;

  return (
    // Avatars come from the identity provider on arbitrary hosts, and
    // next/image would need every one of them allow-listed.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      title={title}
      width={size}
      height={size}
      className={className}
      onError={() => setBroken(true)}
    />
  );
}
