/**
 * PM2 process file for the production VM (flat layout — no releases).
 *
 *   /home/deploy/canvasflow/
 *     ├── .env                  (prod secrets)
 *     ├── ecosystem.config.cjs  ← this file
 *     ├── web/apps/web/server.js
 *     ├── api/dist/index.js
 *     └── db/{drizzle/,migrate.mjs}
 *
 * Both processes bind to 127.0.0.1 only — Nginx (443) terminates TLS
 * and reverse-proxies into them. NEVER bind these to 0.0.0.0; the Azure
 * NSG should only have 22/80/443 open externally.
 */

const path = require("path");

const BASE = process.env.DEPLOY_DIR || __dirname;

module.exports = {
  apps: [
    {
      name: "canvasflow-api",
      cwd: path.join(BASE, "dist/api"),
      script: "./dist/index.js",
      env: {
        NODE_ENV: "production",
        PORT: "8000",
      },
      instances: 1,
      exec_mode: "fork",
      max_memory_restart: "400M",
      max_restarts: 10,
      min_uptime: "10s",
    },
    {
      name: "canvasflow-web",
      cwd: path.join(BASE, "apps/web/.next/standalone/apps/web"),
      script: "./server.js",
      env: {
        NODE_ENV: "production",
        PORT: "3000",
        HOSTNAME: "127.0.0.1",
      },
      instances: 1,
      exec_mode: "fork",
      max_memory_restart: "500M",
      max_restarts: 10,
      min_uptime: "10s",
    },
  ],
};

