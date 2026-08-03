import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    include: ["packages/**/*.test.ts"],
    globals: true
  },
  resolve: {
    alias: {
      "@governor/core": path.resolve(__dirname, "packages/core/src/index.ts"),
      "@governor/gateway": path.resolve(__dirname, "packages/gateway/src/index.ts"),
      "@governor/server": path.resolve(__dirname, "packages/server/src/index.ts"),
      "@governor/storage": path.resolve(__dirname, "packages/storage/src/index.ts"),
      "@governor/sdk": path.resolve(__dirname, "packages/sdk-js/src/index.ts"),
      softstop: path.resolve(__dirname, "packages/sdk-js/src/index.ts")
    }
  }
});
