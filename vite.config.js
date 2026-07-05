import { defineConfig } from "vite";

// Repo is served from https://<user>.github.io/3DTrainSim/ on GitHub Pages.
export default defineConfig({
  plugins: [],
  base: process.env.GITHUB_ACTIONS ? "/3DTrainSim/" : "/",
});
