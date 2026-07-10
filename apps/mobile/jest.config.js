// jest-expo's own preset transformIgnorePatterns already accounts for
// pnpm's `.pnpm/` nested node_modules layout; we extend that (rather than
// the classic non-pnpm pattern) so packages installed under `.pnpm/` keep
// being transformed, and add nativewind/react-native-css-interop on top.
module.exports = {
  preset: "jest-expo",
  setupFilesAfterEnv: ["<rootDir>/jest.setup.ts"],
  transformIgnorePatterns: [
    "/node_modules/(?!(.pnpm|react-native|@react-native|@react-native-community|expo|@expo|@expo-google-fonts|react-navigation|@react-navigation|@sentry/react-native|native-base|standard-navigation|nativewind|react-native-css-interop))",
    "/node_modules/react-native-reanimated/plugin/",
    "/node_modules/@react-native/babel-preset/",
  ],
};
