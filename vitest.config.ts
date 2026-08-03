import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    include: [
      "governor/tests/**/*.test.ts",
      "packages/core/src/pressure/**/*.test.ts"
    ],
    globals: true,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "governor"),
      "@governor/core": path.resolve(__dirname, "packages/core/src/index.ts"),
    },
  },
});
