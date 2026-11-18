import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// GitHub Pages project sites are served from /{repo}/ — assets must use that prefix.
const pagesBase = process.env.GITHUB_PAGES === "true" ? "/anonymoustiktok/" : "/";

export default defineConfig({
  plugins: [react()],
  base: pagesBase,
  server: {
    proxy: {
      "/api": {
        target: "http://127.0.0.1:8888",
        changeOrigin: true,
      },
    },
  },
});