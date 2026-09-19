import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),

    VitePWA({
      // generateSW: Workbox generates the SW entirely from this config.
      // No hand-authored SW file needed; no CDN importScripts; no runtime
      // dependency on external servers for the SW to function offline.
      strategies: 'generateSW',

      // autoUpdate: the SW updates in the background silently.
      // On next navigation the new version activates.
      registerType: 'autoUpdate',

      // Precache all built assets (JS / CSS / HTML / icons / fonts).
      // Vite-hashed filenames are included automatically via the Rollup
      // manifest Workbox reads at build time — these are the files that
      // must be available for the SPA to render without a network connection.
      includeAssets: ['favicon.svg', 'pwa-192.png', 'pwa-512.png'],

      workbox: {
        // SPA navigation fallback.
        // When the browser navigates to any route (e.g. /contributor-portal,
        // /dashboard/entry, /dashboard/submissions) and the network is
        // unavailable, Workbox serves the precached /index.html.
        // React Router then renders the correct component client-side.
        navigateFallback: '/index.html',

        // Do NOT let the navigation fallback intercept:
        //   - Firebase Auth OAuth redirects (/__/)
        //   - Backend API calls (/api/)
        //   - Chrome extension requests
        navigateFallbackDenylist: [
          /^\/__\//,
          /^\/api\//,
          /^\/cdn-cgi\//,
        ],

        // Precache every JS, CSS, HTML, SVG, PNG, WOFF2 Vite emits.
        globPatterns: ['**/*.{js,css,html,svg,png,woff2,ico}'],

        // Explicit cache-busting: clean stale precache entries when the SW
        // updates so old hashed assets don't accumulate.
        cleanupOutdatedCaches: true,

        // Runtime caching rules — applied for requests NOT in the precache.
        runtimeCaching: [
          // Google Fonts stylesheets
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'google-fonts-stylesheets',
              expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          // Google Fonts files (woff2 etc.)
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-webfonts',
              expiration: { maxEntries: 30, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          // Explicitly EXCLUDE backend API and Firebase Auth from caching.
          // These must always go to the network; the IndexedDB queue handles
          // the offline submission flow for /api/reports specifically.
          // No runtimeCaching entry = requests fall through to network (and
          // fail gracefully if offline — which is the intended behaviour).
        ],
      },

      manifest: {
        name: 'Arogya360 Health Dashboard',
        short_name: 'Arogya360',
        description: 'Contributor health reporting and community insights dashboard',
        theme_color: '#5856D6',
        background_color: '#F8F9FF',
        display: 'standalone',
        orientation: 'portrait',
        scope: '/',
        start_url: '/contributor-portal',
        icons: [
          {
            src: 'pwa-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: 'pwa-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable',
          },
        ],
      },

      // devOptions: keep disabled in development.
      // The SW intercepts all fetch calls — enabling it in dev breaks Vite's
      // HMR websocket and module hot-reload.  Test offline behaviour using
      // `npm run preview` against a production build instead.
      devOptions: {
        enabled: false,
      },
    }),
  ],
})
