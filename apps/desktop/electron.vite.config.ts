import { resolve } from "node:path";
import { defineConfig } from "electron-vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  main: {
    build: {
      outDir: "out/main",
      rollupOptions: { input: resolve(__dirname, "src/main/index.ts") },
    },
    // Node built-ins and node_modules deps stay external in the main process
    // (it runs in Node, not a browser) - this is electron-vite's default
    // (build.externalizeDeps: true) so no extra config needed here.
  },
  preload: {
    build: {
      outDir: "out/preload",
      rollupOptions: {
        input: resolve(__dirname, "src/preload/index.ts"),
        output: {
          // Electron's SANDBOXED preload loader does not support ESM `import`
          // syntax at all - it runs preload scripts through its own bundle
          // execution context, not Node's normal module loader, so the
          // file-extension-based ESM detection that works for the main
          // process does not apply here. Forcing real CommonJS output (with
          // an explicit .cjs extension, since package.json says "type":
          // "module") is what actually works with sandbox: true.
          format: "cjs",
          entryFileNames: "[name].cjs",
        },
      },
    },
  },
  renderer: {
    root: "src/renderer",
    resolve: {
      // In an npm-workspaces monorepo, Vite's dependency pre-bundling can
      // occasionally resolve react/react-dom/@emotion through more than one
      // symlinked path and treat them as separate modules - even though only
      // one real copy is installed (hoisted to the repo root). That's what
      // "Invalid hook call" / "more than one copy of React" actually means
      // here; forcing dedupe makes Vite always resolve to the single real copy.
      dedupe: ["react", "react-dom", "@emotion/react", "@emotion/styled"],
    },
    build: {
      outDir: "out/renderer",
      rollupOptions: { input: resolve(__dirname, "src/renderer/index.html") },
    },
    plugins: [react()],
  },
});