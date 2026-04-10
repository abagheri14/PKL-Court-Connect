import { jsxLocPlugin } from "@builder.io/vite-plugin-jsx-loc";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { defineConfig } from "vite";

const plugins = [react(), tailwindcss(), jsxLocPlugin()];

export default defineConfig({
  plugins,
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "client", "src"),
      "@shared": path.resolve(import.meta.dirname, "shared"),
      "@assets": path.resolve(import.meta.dirname, "attached_assets"),
    },
  },
  envDir: path.resolve(import.meta.dirname),
  root: path.resolve(import.meta.dirname, "client"),
  publicDir: path.resolve(import.meta.dirname, "client", "public"),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
    chunkSizeWarningLimit: 2000,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("node_modules")) {
            if (id.includes("react-dom")) return "vendor";
            if (id.includes("@radix-ui") || id.includes("lucide-react") || id.includes("framer-motion") || id.includes("class-variance-authority") || id.includes("sonner")) return "ui";
            if (id.includes("@tanstack/react-query") || id.includes("@trpc") || id.includes("superjson") || id.includes("zod")) return "data";
            if (id.includes("mapbox-gl")) return "maps";
            if (id.includes("recharts") || id.includes("d3-")) return "charts";
            if (id.includes("@stripe") || id.includes("stripe")) return "stripe";
            if (id.includes("i18next")) return "i18n";
            if (id.includes("firebase")) return "firebase";
          }
        },
      },
    },
  },
  server: {
    host: true,
    allowedHosts: true,
    fs: {
      strict: true,
      deny: ["**/.*"],
    },
  },
});
