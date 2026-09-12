import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /// Loopback by address as well as by name.
  ///
  /// `next dev` refuses to serve its own dev-only resources — Fast Refresh,
  /// the HMR socket — to an origin it was not told about, and answers 403.
  /// The browser then keeps running whichever bundle it already had, so an
  /// edit appears to do nothing at all rather than to fail. Only the dev
  /// server reads this.
  allowedDevOrigins: ["127.0.0.1"],
  images: {
    // Place photographs come from Wikipedia, which serves its thumbnails from
    // these two hosts. Narrowed to the thumbnail path rather than the whole
    // host: nothing here should be able to point next/image at an arbitrary
    // original upload.
    remotePatterns: [
      { protocol: "https", hostname: "upload.wikimedia.org", pathname: "/wikipedia/**" },
      { protocol: "https", hostname: "thumb.wikimedia.org", pathname: "/wikipedia/**" },
    ],
  },
};

export default nextConfig;
