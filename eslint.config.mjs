import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Vendored POP KIT source. Copied verbatim out of the .skill package by
    // scripts/sync-popkit.mjs and kept byte-identical so `--check` can prove it
    // has not forked; linting it would only invite edits that break that.
    "src/lib/popkit/kit/**",
  ]),
]);

export default eslintConfig;
