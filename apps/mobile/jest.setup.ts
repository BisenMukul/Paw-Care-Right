// @testing-library/react-native v13+ auto-registers its Jest matchers
// (toBeOnTheScreen, etc.) as soon as any test imports from the package —
// there is no longer a separate `/extend-expect` entry point to import
// here (that was the deprecated `@testing-library/jest-native` pattern).
// This file is kept as the wired `setupFilesAfterEnv` hook for future
// global test setup.
export {};
