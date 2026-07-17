// `tailwind-preset.mjs` is ESM with a default export, but this config must stay
// CommonJS for NativeWind/Metro. `require()` therefore yields the module namespace
// (`{ __esModule, default }`), which has no top-level `theme` — Tailwind silently
// ignores such a preset, dropping the whole brand scale so `bg-brand-*` renders as
// nothing. Unwrap `.default`; the `??` keeps this correct under loaders (e.g. jiti
// with interopDefault) that already unwrap it.
const brandPreset = require("@pawcareright/config/tailwind");

/** @type {import('tailwindcss').Config} */
module.exports = {
  // NativeWind's own preset MUST come first (v4 metro withNativeWind requires it),
  // then the shared brand preset. Web (plain Tailwind) needs only the brand preset.
  presets: [require("nativewind/preset"), brandPreset.default ?? brandPreset],
  content: ["./app/**/*.{ts,tsx}", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {},
  },
  plugins: [],
};
