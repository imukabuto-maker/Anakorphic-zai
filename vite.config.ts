import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

// For GitHub Pages builds, set VITE_BASE to "/<repo-name>/" (see the
// deploy workflow in .github/workflows/deploy.yml). Defaults to "/" for
// local dev and for platforms that serve from the domain root (Vercel,
// Netlify, Cloudflare Pages, etc).
const resolvedBase = process.env.VITE_BASE ?? "/";

export default defineConfig({
  base: resolvedBase,
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
    },
    dedupe: ["react", "react-dom"],
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
    rollupOptions: {
      output: {
        manualChunks: {
          "vendor-react": ["react", "react-dom"],
          "vendor-three": ["three"],
          "vendor-ui": [
            "@radix-ui/react-slider",
            "@radix-ui/react-switch",
            "@radix-ui/react-tooltip",
            "@radix-ui/react-dialog",
            "@radix-ui/react-select",
            "@radix-ui/react-label",
            "lucide-react",
          ],
          "vendor-pdf": ["jspdf", "svg2pdf.js"],
          "vendor-motion": ["framer-motion"],
        },
      },
    },
  },
  server: {
    port: 3000,
    host: "0.0.0.0",
  },
  preview: {
    port: 3000,
    host: "0.0.0.0",
  },
});
