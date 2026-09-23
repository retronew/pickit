import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import reactCall from "react-call/vite";
import { fileURLToPath, URL } from "node:url";

export default defineConfig({
  plugins: [react(), tailwindcss(), reactCall()],
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
