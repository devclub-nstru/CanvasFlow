import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.dirname(fileURLToPath(import.meta.url));

/* Workspace packages declare no `main` or `exports`, so Vite cannot resolve
 * `@repo/*` on its own the way tsx does. One regex alias covers every form the
 * codebase uses: the bare package, a nested directory (resolved to its
 * index.ts) and a direct file. */
const repoAlias = [
  {
    find: /^@repo\/([^/]+)(\/.*)?$/,
    replacement: path.join(root, "packages", "$1$2"),
  },
];

const webAlias = [
  { find: /^~\/(.*)$/, replacement: path.join(root, "apps", "web", "$1") },
  { find: /^@\/(.*)$/, replacement: path.join(root, "apps", "web", "$1") },
  ...repoAlias,
];

const setup = [path.join(root, "tests", "setup", "env.ts")];
const mentiSetup = [...setup, path.join(root, "tests", "setup", "menti-env.ts")];

export default defineConfig({
  test: {
    projects: [
      {
        resolve: { alias: webAlias },
        test: {
          name: "web",
          root,
          environment: "jsdom",
          setupFiles: setup,
          include: ["apps/web/tests/**/*.test.{ts,tsx}"],
        },
      },
      {
        resolve: { alias: repoAlias },
        test: {
          name: "services",
          root,
          environment: "node",
          setupFiles: setup,
          include: ["packages/services/tests/**/*.test.ts"],
        },
      },
      {
        resolve: { alias: repoAlias },
        test: {
          name: "trpc",
          root,
          environment: "node",
          setupFiles: setup,
          include: ["packages/trpc/tests/**/*.test.ts"],
          /* scrypt at N=2^15 is deliberately slow; the password tests need
           * more than the 5s default. */
          testTimeout: 30_000,
        },
      },
      {
        resolve: { alias: repoAlias },
        test: {
          name: "api",
          root,
          environment: "node",
          setupFiles: setup,
          include: ["apps/api/tests/**/*.test.ts"],
        },
      },
      {
        resolve: { alias: repoAlias },
        test: {
          name: "worker",
          root,
          environment: "node",
          setupFiles: setup,
          include: ["apps/worker/tests/**/*.test.ts"],
        },
      },
      {
        resolve: { alias: repoAlias },
        test: {
          name: "guards",
          root,
          environment: "node",
          setupFiles: setup,
          include: ["tests/guards/**/*.test.ts"],
        },
      },
      {
        resolve: { alias: repoAlias },
        test: {
          name: "menti",
          root,
          environment: "node",
          setupFiles: mentiSetup,
          include: ["apps/menti/tests/**/*.test.js"],
        },
      },
    ],
    coverage: {
      provider: "v8",
      reportsDirectory: path.join(root, "coverage"),
      reporter: ["text", "html", "lcov"],
      /* Only what the unit suite actually claims to cover. Service classes and
       * React components are deliberately absent: adding them would report a
       * low number that says nothing about whether the tested units are
       * tested well. */
      include: [
        "apps/web/lib/form-flow.ts",
        "apps/web/lib/form-logic.ts",
        "apps/web/lib/form-access.ts",
        "apps/web/lib/fractional-index.ts",
        "apps/web/lib/upload.ts",
        "apps/web/lib/utils.ts",
        "apps/web/lib/pending-signup.ts",
        "apps/api/src/lib/rate-limiter.ts",
        "apps/worker/src/processors/upload.ts",
        "apps/menti/src/modules/quiz/quizScorer.js",
        "apps/menti/src/modules/quiz/quizTimerManager.js",
        "apps/menti/src/modules/presentation/pptxValidation.js",
        "apps/menti/src/modules/session/session.schemas.js",
        "apps/menti/src/modules/presentation/presentation.schemas.js",
        "apps/menti/src/core/auth/jwt.js",
        "apps/menti/src/core/env/env.js",
        "apps/menti/realtime/rateLimiter.js",
        "apps/menti/realtime/utils.js",
        "packages/services/mail/index.ts",
        "packages/services/form-submission/access.ts",
        "packages/services/form/model.ts",
        "packages/services/form-field/model.ts",
        "packages/services/form-logic/model.ts",
        "packages/services/form-segment/model.ts",
        "packages/services/form-submission/model.ts",
        "packages/services/form-upload/model.ts",
        "packages/services/form-draft/model.ts",
        "packages/services/feedback/model.ts",
        "packages/trpc/server/auth.ts",
      ],
      exclude: ["**/node_modules/**", "**/tests/**", "**/*.d.ts"],
    },
  },
});
