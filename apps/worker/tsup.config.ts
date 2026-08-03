import { defineConfig } from "tsup";
export default defineConfig({
  entry: ["./src/index.ts"],
  noExternal: [/@repo\/.*/],
  format: ["esm"],
  splitting: false,
  bundle: true,
  outDir: "./dist",
  clean: true,
  env: { IS_SERVER_BUILD: "true" },
  loader: { ".json": "copy" },
  minify: false,
  sourcemap: false,
  banner: {
    js: `import { createRequire } from 'module'; const require = createRequire(import.meta.url);`,
  },
});
