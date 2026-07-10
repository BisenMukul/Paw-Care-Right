import preset from "@pawcareright/config/tailwind";

/** @type {import('tailwindcss').Config} */
export default {
  presets: [preset],
  content: ["./app/**/*.{ts,tsx}", "./src/**/*.{ts,tsx}"],
  theme: { extend: {} },
  plugins: [],
};
