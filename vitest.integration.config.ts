import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.dirname(fileURLToPath(import.meta.url));

const repoAlias = [
  {
    find: /^@repo\/([^/]+)(\/.*)?$/,
    replacement: path.join(root, "packages", "$1$2"),
  },
  /* The export lives in the web app but reads rows the service produced, so the
   * end-to-end test of it needs to import both halves. */
  { find: /^~\/(.*)$/, replacement: path.join(root, "apps", "web", "$1") },
];

export default defineConfig({
  resolve: { alias: repoAlias },
  test: {
    name: "integration",
    root,
    environment: "node",
    include: ["tests/integration/**/*.test.ts"],

    setupFiles: [path.join(root, "tests", "integration", "setup", "env.ts")],

    globalSetup: [path.join(root, "tests", "integration", "setup", "global.ts")],

    fileParallelism: false,

    testTimeout: 30_000,
    hookTimeout: 60_000,

    pool: "forks",
    poolOptions: { forks: { singleFork: true } },

    coverage: {
      provider: "v8",
      reportsDirectory: path.join(root, "coverage-integration"),
      reporter: ["text", "html"],
      include: ["packages/services/**", "packages/trpc/server/**", "apps/api/src/**"],
      exclude: ["**/node_modules/**", "**/tests/**", "**/*.d.ts"],
    },
  },
});
