import { config } from "@repo/eslint-config/base";

/** @type {import("eslint").Linter.Config[]} */
export default [
  ...config,
  {
    rules: {
      // Runtime env vars (Mongo URI, auth URL, trusted origins) aren't turbo
      // build inputs — same exemption as the api and worker packages.
      "turbo/no-undeclared-env-vars": "off",
    },
  },
];
