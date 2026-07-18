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
        // Dual-theme dark-mode semantic tokens (PAWSAATHI-1 plan, additive --
        // `brand.*` above is untouched). These are the ONLY colors the
        // `dark:` variants sweep uses; light appearance keeps its existing
        // `brand-*` classes verbatim (design-system.md §1.1/§1.6).
        surface: {
          "page-dark": "#0c140f",
          "card-dark": "#16241F",
          "raised-dark": "#143026",
        },
        ink: {
          dark: "#E7E0D3",
          "muted-dark": "#9AA8A1",
          "faint-dark": "#6E827A",
        },
        accent: {
          DEFAULT: "#1f6350",
          dark: "#1E6B54",
          bright: "#2EA57C",
          warm: "#FF7A59",
        },
        category: {
          lilac: "#8B7BD8",
          amber: "#F6A623",
          sky: "#4C9BD6",
        },
        hairline: {
          dark: "#22392F",
        },
      },
      // Weight-keyed font-family tokens (PAWSAATHI-1 plan Decision 2): named
      // static Google-Fonts faces pin weight on native, so each existing
      // weight class gets its own token rather than a single `font-body`
      // that would silently stay regular weight everywhere.
      fontFamily: {
        display: ["BricolageGrotesque_700Bold"],
        "display-semibold": ["BricolageGrotesque_600SemiBold"],
        body: ["PlusJakartaSans_400Regular"],
        "body-semibold": ["PlusJakartaSans_600SemiBold"],
        "body-bold": ["PlusJakartaSans_700Bold"],
      },
    },
  },
};
