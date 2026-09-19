/**
 * useOfflineSync.js
 * =================
 * React hook that manages:
 *   1. Live connectivity state (isOnline)
 *   2. Pending-queue count (pendingCount)
 *   3. Auto-sync on reconnect / app foreground
 *   4. "N reports synced" confirmation message
 *
 * Sync triggers (no Background Sync API — intentionally not used):
 *   - window 'online' event  — fires when the browser detects connectivity.
 *     Unreliable on iOS Safari (can lag or miss cellular↔Wi-Fi switches), so
 *     it is one of two triggers, not the only one.
 *   - document 'visibilitychange' to visible  — fires when the user returns to
 *     the tab/app after it was backgrounded.  This is the more reliable iOS
 *     Safari trigger and catches the "restored connectivity while the tab was
 *     in the background" case.
 *   - Mount  — syncs any queue left over from a previous session on first load.
 *
 * Network signal strategy:
 *   navigator.onLine is checked as a quick gate before attempting a fetch.
 *   However, navigator.onLine returning true is NOT a guarantee of internet
 *   access (captive portals, iOS quirks).  The authoritative signal is whether
 *   the actual API call succeeds.  A failed POST keeps the record in the queue;
 *   the next trigger will retry.
 *
 * Parameters:
 *   apiFetchFn    — the project's auth-aware fetch helper (async function)
 *   onSyncSuccess — optional callback fired after each successful batch sync;
 *                   receives (syncedCount) as argument.  Used by the portal to
 *                   refresh the submissions list.
 *
 * Returns:
 *   {
 *     isOnline:       bool     — current navigator.onLine state (reactive)
 *     pendingCount:   number   — items currently in the IndexedDB queue
 *     syncMessage:    string   — e.g. "3 reports synced" (cleared after 4 s)
 *     refreshPending: fn       — call after enqueueing to update the count
 *   }
 *
 * iOS Safari known limitations (honest, not aspirational):
 *   - The 'online' event fires inconsistently when switching between Wi-Fi and
 *     cellular.  The visibilitychange trigger compensates.
 *   - navigator.onLine returns true on captive portals.  The failed-fetch path
 *     handles this correctly.
 *   - There is NO Background Sync API on iOS Safari (as of 2026).  Sync only
 *     happens while the app is in the foreground.  If a contributor submits
 *     offline and never reopens the app, their queue will not sync.
 *   - iOS may suspend JS execution for backgrounded tabs.  The visibilitychange
 *     trigger fires on return-to-foreground, which is the correct moment.
 *   - IndexedDB storage can be evicted under extreme OS storage pressure.
 *     Routine use is not affected; the risk is real but low in practice.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { getAllQueued, queueCount, removeQueued } from '../lib/reportQueue';

const API_BASE = import.meta.env.VITE_API_BASE_URL;

// How long the "N reports synced" confirmation banner stays visible (ms).
const SYNC_MESSAGE_TTL = 4000;

export function useOfflineSync(apiFetchFn, onSyncSuccess) {
  const [isOnline,     setIsOnline]     = useState(navigator.onLine);
  const [pendingCount, setPendingCount] = useState(0);
  const [syncMessage,  setSyncMessage]  = useState('');

  // Guard against concurrent sync runs (e.g. online event + visibilitychange
  // firing at the same millisecond).
  const syncingRef   = useRef(false);
  // Timer ref for clearing the syncMessage banner.
  const msgTimerRef  = useRef(null);

  // ── Refresh the pending count from IndexedDB ──────────────────────────────
  const refreshPending = useCallback(async () => {
    try {
      const n = await queueCount();
      setPendingCount(n);
    } catch {
      // IndexedDB unavailable — treat as zero
      setPendingCount(0);
    }
  }, []);

  // ── Sync loop — attempts to flush the entire queue ───────────────────────
  const syncQueue = useCallback(async () => {
    // Quick gate: if the browser says we're offline, don't even try.
    if (!navigator.onLine) return;
    // Prevent concurrent runs.
    if (syncingRef.current) return;
    syncingRef.current = true;

    let synced = 0;

    try {
      const items = await getAllQueued();
      if (items.length === 0) {
        syncingRef.current = false;
        return;
      }

      for (const item of items) {
        // Extract only the fields the backend expects — strip queued_at.
        const { queued_at: _discard, ...payload } = item; // eslint-disable-line no-unused-vars

        try {
          const res = await apiFetchFn('/api/reports', {
            method: 'POST',
            body:   JSON.stringify(payload),
          });

          if (res.ok || res.status === 200 || res.status === 201) {
            // 200 = idempotent duplicate already on server, 201 = fresh insert.
            // Either way the record is now on the server — remove from queue.
            await removeQueued(item.client_report_id);
            synced++;
          } else if (res.status === 422) {
            // Validation error — this record will never succeed.  Remove it
            // from the queue and log; don't block other items.
            console.warn(
              '[useOfflineSync] Removing invalid queued record (422):',
              item.client_report_id,
            );
            await removeQueued(item.client_report_id);
          }
          // Any other non-OK status (403, 5xx, etc.) — leave in queue, retry
          // on the next trigger.
        } catch {
          // Network failure on this individual item — leave in queue.
          // Don't break the loop; continue with remaining items.
        }
      }
    } catch (err) {
      console.error('[useOfflineSync] syncQueue error:', err);
    } finally {
      syncingRef.current = false;
    }

    // Update pending count after sync pass.
    await refreshPending();

    if (synced > 0) {
      const msg = `${synced} report${synced !== 1 ? 's' : ''} synced`;
      setSyncMessage(msg);
      if (msgTimerRef.current) clearTimeout(msgTimerRef.current);
      msgTimerRef.current = setTimeout(() => setSyncMessage(''), SYNC_MESSAGE_TTL);

      if (typeof onSyncSuccess === 'function') {
        onSyncSuccess(synced);
      }
    }
  }, [apiFetchFn, onSyncSuccess, refreshPending]);

  // ── Online / offline event listeners ─────────────────────────────────────
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      syncQueue();
    };
    const handleOffline = () => {
      setIsOnline(false);
    };

    // visibilitychange: fires when the user returns to the tab/app.
    // This is the primary iOS Safari sync trigger — more reliable than 'online'.
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        setIsOnline(navigator.onLine);
        if (navigator.onLine) syncQueue();
      }
    };

    // focus: catches desktop browser tab switches and window restore.
    const handleFocus = () => {
      setIsOnline(navigator.onLine);
      if (navigator.onLine) syncQueue();
    };

    window.addEventListener('online',  handleOnline);
    window.addEventListener('offline', handleOffline);
    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('focus', handleFocus);

    // On mount: load pending count, then attempt sync if online.
    refreshPending().then(() => {
      if (navigator.onLine) syncQueue();
    });

    return () => {
      window.removeEventListener('online',  handleOnline);
      window.removeEventListener('offline', handleOffline);
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('focus', handleFocus);
      if (msgTimerRef.current) clearTimeout(msgTimerRef.current);
    };
  }, [syncQueue, refreshPending]);

  return { isOnline, pendingCount, syncMessage, refreshPending };
}
