import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  return {
    server: {
      host: "::",
      port: 8080,
    },
    // Keep the browser environment allowlist explicit. Server-only secrets
    // must never be made available through Vite's import.meta.env replacement.
    envPrefix: ["VITE_"],
    build: {
      sourcemap: false,
    },
    plugins: [react()],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
  };
});
