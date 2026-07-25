// Single source of truth for every internal href on the web marketing
// surface, and for the AC3 link validator (T086 D3 — this task adds no new
// route, so this list is exactly the three existing static routes plus the
// programmatic food-safety pages).
import { allFoodPagePaths } from "./food/params";

export const MARKETING_ROUTES = {
  home: "/",
  privacy: "/privacy",
  terms: "/terms",
} as const;

export const STATIC_ROUTES: readonly string[] = [
  MARKETING_ROUTES.home,
  MARKETING_ROUTES.privacy,
  MARKETING_ROUTES.terms,
];

/** Every internal path the built site actually generates. */
export function knownInternalRoutes(): Set<string> {
  return new Set([...STATIC_ROUTES, ...allFoodPagePaths()]);
}
