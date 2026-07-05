import { defineConfig } from "vite";

import { cloudflare } from "@cloudflare/vite-plugin";

// Repo is served from https://<user>.github.io/3DTrainSim/ on GitHub Pages.
export default defineConfig({
  plugins: [cloudflare()],
  base: process.env.GITHUB_ACTIONS ? "/3DTrainSim/" : "/",
});