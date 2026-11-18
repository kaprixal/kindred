import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // fixtures/calendar.ics is read at runtime by the API routes.
  outputFileTracingIncludes: { "/api/**": ["./fixtures/**"] },
  // Product images are plain <img> tags on Shopify's CDN (resized with its ?width= param),
  // not next/image, so Kindred never re-hosts merchant images.
};

export default nextConfig;
