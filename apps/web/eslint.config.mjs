import nextPlugin from "@next/eslint-plugin-next";
import sharedConfig from "@pawcareright/config/eslint";

export default [
  { ignores: [".next/**", "next-env.d.ts"] },
  ...sharedConfig,
  {
    ...nextPlugin.flatConfig.coreWebVitals,
    files: ["app/**/*.{ts,tsx}", "src/**/*.{ts,tsx}"],
  },
];
