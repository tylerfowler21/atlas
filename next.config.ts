import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
