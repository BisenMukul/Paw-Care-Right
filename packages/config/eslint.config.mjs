// Shared ESLint 9 flat config for all Paw Care Right + workspaces.
//
// This base intentionally uses the NON type-checked `typescript-eslint`
// recommended preset (no `parserOptions.project`) so it stays portable to
// every workspace without requiring a tsconfig lookup at lint time. Workspaces
// that want type-aware linting can layer `tseslint.configs.recommendedTypeChecked`
// on top of this array with their own `parserOptions.project`.
//
// NOTE (future): `no-console` is `"error"` here because no `api` workspace
// exists yet. When `apps/api` (NestJS) is created, it should layer an
// override on top of this base rather than relaxing it here, e.g.:
//
//   {
//     files: ["**/main.ts", "**/*.logger.ts"],
//     rules: { "no-console": "off" },
//   }
//
// This keeps the shared base strict while letting the one legitimate
// Nest-Logger bootstrap file opt out explicitly.

import importX from "eslint-plugin-import-x";
import tseslint from "typescript-eslint";
import prettierConfig from "eslint-config-prettier";

export default [
  {
    ignores: ["**/node_modules/**", "**/dist/**"],
  },
  ...tseslint.configs.recommended,
  {
    plugins: {
      "import-x": importX,
    },
    rules: {
      "import-x/order": "error",
      "no-console": "error",
    },
  },
  prettierConfig,
];
