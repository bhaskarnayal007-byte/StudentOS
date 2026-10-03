import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  // "@/components/ui/topo-field" → src/components/ui/topo-field.
  // tsconfig.json declares the same mapping for the editor; this is the one
  // that actually resolves at build time.
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },

  plugins: [
    react(),
    VitePWA({
      // Rebuild the cache and swap it in as soon as a new version is deployed,
      // instead of asking the user to click "reload".
      registerType: 'autoUpdate',

      // Lets you test the installed/offline behaviour with `npm run dev`.
      devOptions: { enabled: true },

      // The manifest: what the OS reads when you install the app. This is what
      // gives you an icon, a name, and a window with no browser address bar.
      manifest: {
        name: 'Student OS',
        short_name: 'Student OS',
        description: 'Calendar, tasks, schedule, timers and an AI assistant.',
        theme_color: '#2E5334',
        // Matches the icon's own badge, so the splash behind it isn't a
        // pale rectangle around a dark tile.
        background_color: '#090408',
        display: 'standalone', // ← this is the line that removes browser chrome
        start_url: '/',
        icons: [
          { src: 'pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png' },
          // "maskable" lets Android crop the icon into its own shape
          // (circle, squircle) without clipping something important — which
          // is why it's a separate, inset rendering, not the same file.
          { src: 'pwa-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },

      workbox: {
        // Files precached at install time = the app shell. With these cached,
        // the app opens with no network at all. Your DATA was already offline —
        // it lives in localStorage. This step is about the code itself.
        globPatterns: ['**/*.{js,css,html,png,svg,woff2}'],
      },
    }),
  ],
})
