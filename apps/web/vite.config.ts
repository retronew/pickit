import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import reactCall from "react-call/vite";
import { fileURLToPath, URL } from "node:url";
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";

// Build metadata shown in Settings. In CI, GITHUB_SHA is set; locally we ask git.
function gitCommit(): string {
  if (process.env.GITHUB_SHA) return process.env.GITHUB_SHA;
  try {
    return execSync("git rev-parse HEAD", { stdio: ["ignore", "pipe", "ignore"] })
      .toString()
      .trim();
  } catch {
    return "";
  }
}

const rootPkg = JSON.parse(
  readFileSync(new URL("../../package.json", import.meta.url), "utf8"),
) as { version: string };

const repoUrl =
  process.env.GITHUB_SERVER_URL && process.env.GITHUB_REPOSITORY
    ? `${process.env.GITHUB_SERVER_URL}/${process.env.GITHUB_REPOSITORY}`
    : "";

export default defineConfig({
  plugins: [react(), tailwindcss(), reactCall()],
  define: {
    __APP_VERSION__: JSON.stringify(rootPkg.version),
    __APP_COMMIT__: JSON.stringify(gitCommit()),
    __APP_BUILD_TIME__: JSON.stringify(new Date().toISOString()),
    __APP_REPO_URL__: JSON.stringify(repoUrl),
  },
  resolve: {
    alias: [
      {
        find: /^#(hooks|pages|components|lib)\/(.*)/,
        replacement: fileURLToPath(new URL("./src/$1/$2", import.meta.url)),
      },
      {
        find: "#AppShell",
        replacement: fileURLToPath(new URL("./src/AppShell", import.meta.url)),
      },
    ],
  },
  build: {
    outDir: "../api/dist",
    emptyOutDir: true,
  },
  server: {
    proxy: {
      "/api": "http://127.0.0.1:8787",
    },
  },
});
