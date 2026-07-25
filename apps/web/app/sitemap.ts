import type { MetadataRoute } from "next";
import { SITE_URL } from "../src/site";
import { allFoodPagePaths } from "../src/food/params";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: `${SITE_URL}/` },
    { url: `${SITE_URL}/privacy` },
    { url: `${SITE_URL}/terms` },
    ...allFoodPagePaths().map((path) => ({ url: `${SITE_URL}${path}` })),
  ];
}
