import { execFileSync } from "child_process";
import crypto from "crypto";
import fs from "fs";
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { VitePWA } from "vite-plugin-pwa";
import spaFallback from "./vite-spa-fallback.js";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, __dirname, "");
  const apiProxyTarget = env.API_PROXY_TARGET || "http://127.0.0.1:8000";
  const logoFile = path.resolve(__dirname, "public/connecthub-logo.png");
  const jellySource = path.resolve(__dirname, "public/jelly - logo.png");
  const jellyPublic = path.resolve(__dirname, "public/jelly-logo.png");
  const prepareScript = path.resolve(__dirname, "scripts/prepare-jelly-logo.py");
  try {
    execFileSync("python", [prepareScript], { stdio: "ignore" });
  } catch {
    try {
      execFileSync("py", ["-3", prepareScript], { stdio: "ignore" });
    } catch {
      // Keep the last transparent jelly-logo.png if Python is unavailable.
    }
  }
  const fileVersion = (filePath: string) => {
    if (!fs.existsSync(filePath)) return "1";
    return crypto.createHash("md5").update(fs.readFileSync(filePath)).digest("hex").slice(0, 12);
  };
  const logoVersion = fileVersion(logoFile);
  const jellyVersion = fileVersion(fs.existsSync(jellyPublic) ? jellyPublic : jellySource);

  return {
  server: {
    host: "::",
    port: 3556,
    proxy: {
      "/api": apiProxyTarget,
      "/uploads": apiProxyTarget,
    },
    headers: {
      'Cache-Control': 'no-store',
      'Content-Security-Policy': "default-src 'self' 'unsafe-inline' 'unsafe-eval' http: https: ws: wss: data: blob:; connect-src 'self' ws: wss: http: https: data: blob: 'unsafe-inline' 'unsafe-eval';"
    },
  },
  preview: {
    port: 8080,
    host: "::",
  },
  plugins: [
    {
      name: "connecthub-logo-version",
      transformIndexHtml(html) {
        return html.replaceAll("/connecthub-logo.png", `/connecthub-logo.png?v=${logoVersion}`);
      },
    },
    react(),
    spaFallback(),
    VitePWA({
      registerType: 'prompt',
      includeAssets: ['favicon.svg', 'connecthub-logo.svg', 'connecthub-logo.png', 'jelly-logo.png', 'pwa-192.png', 'pwa-512.png', 'apple-touch-icon.png'],
      manifest: {
        name: 'ConnectHub',
        short_name: 'ConnectHub',
        description: 'Remember what matters.',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        background_color: '#EBF0F7',
        theme_color: '#2563eb',
        icons: [
          { src: '/pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/pwa-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
        ],
      },
      workbox: {
        navigateFallback: '/index.html',
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
        globIgnores: ['**/jelly-logo.png', '**/jelly - logo.png', '**/connecthub-logo.png'],
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.pathname.startsWith('/api') || url.pathname.startsWith('/uploads'),
            handler: 'NetworkOnly',
          },
          {
            urlPattern: ({ url }) =>
              url.pathname === '/jelly-logo.png' ||
              url.pathname === '/connecthub-logo.png' ||
              decodeURIComponent(url.pathname) === '/jelly - logo.png',
            handler: 'NetworkFirst',
            options: { cacheName: 'connecthub-logos', expiration: { maxEntries: 6, maxAgeSeconds: 60 } },
          },
        ],
      },
      devOptions: { enabled: false },
    }),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          // Vendor chunks
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          'ui-vendor': ['@radix-ui/react-dialog', '@radix-ui/react-select', '@radix-ui/react-tabs', '@radix-ui/react-toast'],
          'lucide-vendor': ['lucide-react'],
        },
      },
    },
    chunkSizeWarningLimit: 1000,
  },
  define: {
    "import.meta.env.VITE_LOGO_VERSION": JSON.stringify(logoVersion),
    "import.meta.env.VITE_JELLY_LOGO_VERSION": JSON.stringify(jellyVersion),
  },
  };
});
