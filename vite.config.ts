/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      // 'prompt', never 'autoUpdate': a scanner must not reload itself mid-shift
      // at the door. The update prompt is surfaced by the app shell.
      registerType: 'prompt',
      strategies: 'generateSW',
      includeAssets: ['favicon.svg', 'favicon.ico', 'apple-touch-icon-180x180.png'],
      workbox: {
        globPatterns: ['**/*.{js,css,html,woff2,svg,png}'],
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api/],
        // Runtime caching is deliberately ONE entry: public Storage objects.
        //
        // Nothing from *.supabase.co /rest/v1, /auth/v1 or /realtime/v1 is ever
        // cached, for two reasons:
        //  1. A NetworkFirst (or any) cache on a ticket read serves a stale 200
        //     saying "this ticket is valid" when the venue wifi drops — that is
        //     the double-admit criterion 3 forbids. Offline scanning goes
        //     through the Dexie queue + redeem_tickets RPC, never a cached GET.
        //  2. The Cache API is origin-scoped, not session-scoped. An
        //     RLS-filtered response cached under one user's JWT outlives logout
        //     and is readable by the next account on a shared staff device.
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.pathname.startsWith('/storage/v1/object/public/'),
            handler: 'CacheFirst',
            options: {
              cacheName: 'supabase-public-storage',
              expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 30 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
      manifest: {
        name: 'DoujinDesk',
        short_name: 'DoujinDesk',
        description: 'Convention management for doujin and comic events.',
        start_url: '/',
        display: 'standalone',
        background_color: '#ffffff',
        // ponytail: hardcoded because a webmanifest cannot read a CSS custom
        // property. This duplicates --primary in src/index.css; if the brand
        // colour moves, both change. Upgrade path is generating the manifest
        // from the token file at build time — not worth a build script for one
        // value.
        theme_color: '#d63a00',
        icons: [
          { src: 'pwa-64x64.png', sizes: '64x64', type: 'image/png' },
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'maskable-icon-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/test/setup.ts',
    // ponytail: the runner lands a wave before the first test file does, and
    // vitest exits 1 on an empty run. Drop this line once the critical-path
    // suites exist so a suite that silently stops being collected fails CI.
    passWithNoTests: true,
  },
})
