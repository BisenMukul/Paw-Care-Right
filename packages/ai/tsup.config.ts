import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts", "src/evals/run.ts"],
  format: ["esm", "cjs"],
  dts: true,
  sourcemap: true,
  clean: true,
  target: "es2022",
  // `yaml` (devDependency, harness-only tooling — see packages/ai/package.json)
  // ships its own CJS/ESM dual build with an internal conditional
  // `require("process")` that esbuild cannot statically bundle into an ESM
  // output (throws "Dynamic require of 'process' is not supported" at
  // runtime). Keeping it external makes `dist/evals/run.js` resolve it via
  // normal node_modules resolution at runtime instead of bundling it.
  external: ["yaml"],
});
