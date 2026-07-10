/** @type {import('tailwindcss').Config} */
module.exports = {
  // NativeWind's own preset MUST come first (v4 metro withNativeWind requires it),
  // then the shared brand preset. Web (plain Tailwind) needs only the brand preset.
  presets: [require("nativewind/preset"), require("@pawcareright/config/tailwind")],
  content: ["./app/**/*.{ts,tsx}", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {},
  },
  plugins: [],
};
