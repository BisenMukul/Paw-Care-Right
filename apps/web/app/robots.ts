import type { MetadataRoute } from "next";
import { SITE_URL } from "../src/site";

export default function robots(): MetadataRoute.Robots {
  return {
    // T111: `/admin*` is an internal, read-only reporting surface (basic-auth
    // gated) -- it must never be crawled or indexed.
    rules: [{ userAgent: "*", allow: "/", disallow: "/admin" }],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
