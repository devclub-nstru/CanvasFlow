import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.dirname(fileURLToPath(import.meta.url));

const repoAlias = [
  {
    find: /^@repo\/([^/]+)(\/.*)?$/,
    replacement: path.join(root, "packages", "$1$2"),
  },
];

export default defineConfig({
  resolve: { alias: repoAlias },
  test: {
    name: "integration",
    root,
    environment: "node",
    include: ["tests/integration/**/*.test.ts"],

    /* Sets DATABASE_URL before @repo/database is imported and its pool is
     * built. Order matters more here than anywhere else in the repo. */
    setupFiles: [path.join(root, "tests", "integration", "setup", "env.ts")],

    /* Migrations run once for the whole run, not per file. */
    globalSetup: [path.join(root, "tests", "integration", "setup", "global.ts")],

    /* Every file truncates the whole database, so two running at once would
     * pull the rows out from under each other. Serial is not a performance
     * compromise here — it is the isolation model. */
    fileParallelism: false,

    /* Real I/O, container cold starts, and a migration on the first run. */
    testTimeout: 30_000,
    hookTimeout: 60_000,

    /* One process for the whole suite: a pool per worker would multiply
     * connections and hide pool-exhaustion bugs behind extra headroom. */
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
