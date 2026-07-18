import { APP_DISPLAY_NAME } from "@pawcareright/config";

import { strings } from "../src/strings";

/**
 * CLAUDE.md §1a guard (PAWSAATHI-1 plan): "PawSaathi" is the internal
 * mockup/design-language reference name ONLY -- it must never leak into a
 * user-facing string, identifier, or code. The display name always comes
 * from the shared `APP_DISPLAY_NAME` constant. Scans the imported `strings`
 * object's serialized VALUES (not `node:fs`, which this workspace has no
 * `@types/node` for) so this stays a plain, dependency-free unit test.
 */
describe("no-pawsaathi-branding: the codename never leaks into user-facing surfaces", () => {
  it("APP_DISPLAY_NAME is the exact locked display name, not the codename", () => {
    expect(APP_DISPLAY_NAME).toBe("Paw Care Right +");
    expect(APP_DISPLAY_NAME).not.toMatch(/pawsaathi/i);
  });

  it("src/strings.ts's exported strings contain no 'PawSaathi' or 'Made in India' literal", () => {
    const serialized = JSON.stringify(strings);

    expect(serialized).not.toMatch(/pawsaathi/i);
    expect(serialized).not.toMatch(/made in india/i);
  });
});
