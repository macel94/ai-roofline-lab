import { defineConfig } from "vite";

export default defineConfig({
  // Relative assets work on both the local root and the GitHub Pages repo subpath.
  base: "./",
  build: {
    target: "es2022",
    sourcemap: false,
    cssCodeSplit: true,
  },
});
