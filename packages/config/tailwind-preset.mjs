// Shared Tailwind v3 JS preset for all Paw Care Right + workspaces.
//
// Kept as a plain, directly-loadable ESM file (not routed through tsup) so
// Tailwind's own config loader (jiti) can `import`/`require` it straight
// from source — mirrors `eslint.config.mjs` / `prettier.config.mjs`.
//
// Consumers own `content` and `plugins`; this preset only extends `theme`
// with the shared brand color scale so it can be reused by both a Next.js
// PostCSS pipeline (apps/web) and a Metro + NativeWind pipeline
// (apps/mobile, T008) via `presets: [preset]`.
export default {
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#f2f8f6",
          100: "#dcece6",
          200: "#bcdcd2",
          300: "#8fc4b3",
          500: "#2f8f74",
          600: "#27795f",
          700: "#1f6350",
          900: "#123a30",
        },
      },
    },
  },
};
