import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

// ── Service Worker registration — VitePWA autoUpdate ─────────────────────────
// VitePWA generates sw.js at build time with a full Workbox precache manifest.
// The virtual:pwa-register module handles registration + auto-update cleanly:
//   - Registers /sw.js in production builds only (no-op in dev).
//   - When a new SW is waiting, prompts skipWaiting automatically.
//   - No CDN dependency: Workbox is bundled into the generated sw.js.
//
// iOS Safari: SW registration succeeds on iOS 11.3+.
// There is no beforeinstallprompt on iOS — users must use Share →
// "Add to Home Screen" manually.
import { registerSW } from 'virtual:pwa-register'

registerSW({
  // onNeedRefresh: called when a new SW is waiting.
  // With registerType:'autoUpdate', VitePWA also sets skipWaiting
  // automatically so the new version activates on next navigation.
  onNeedRefresh() {
    // Silently accept — autoUpdate handles this.
  },
  onOfflineReady() {
    // The app is ready to work offline.
    // Could show a toast here in a future iteration.
  },
  onRegisteredSW(swUrl, registration) {
    if (registration) {
      // Poll for updates every 60 minutes so long-running sessions pick up
      // new versions (useful for the contributor portal).
      setInterval(() => {
        registration.update().catch(() => {
          // update() rejects when offline — expected, safe to ignore.
        })
      }, 60 * 60 * 1000)
    }
  },
})

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
