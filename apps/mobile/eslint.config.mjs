import sharedConfig from "@bombaypetcompany/config/eslint";

export default [
  {
    ignores: [
      "app.config.js",
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
