import sharedConfig from "@pawcareright/config/eslint";

export default [
  {
    ignores: [
      "babel.config.js",
      "metro.config.js",
      "tailwind.config.js",
      "jest.config.js",
      ".expo/**",
      "dist/**",
    ],
  },
  ...sharedConfig,
];
