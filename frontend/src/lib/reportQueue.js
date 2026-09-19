/**
 * reportQueue.js
 * ==============
 * IndexedDB-backed queue for offline health-report submissions.
 *
 * Why IndexedDB and not localStorage?
 *   - localStorage is synchronous and stores only strings — unsuitable for
 *     structured records and blocks the main thread on read/write.
 *   - IndexedDB supports structured cloning, async access, and persists across
 *     app restarts, force-close, and OS-level tab termination.
 *
 * Database:  arogya360_offline   (version 1)
 * Object store: pending_reports
 *   keyPath: client_report_id  (the client-generated UUID that is also the
 *                               idempotency key sent to the backend)
 *
 * Records in pending_reports have the exact shape expected by
 * POST /api/reports — no transformation needed at sync time:
 *   {
 *     client_report_id,  // keyPath — also used for backend idempotency
 *     pincode,
 *     category,
 *     esi_level,
 *     case_count,
 *     mode,
 *     reported_date,
 *     queued_at,         // ISO timestamp — informational, not sent to backend
 *   }
 *
 * Durability on force-close:
 *   IndexedDB writes are committed transactionally.  If the browser tab is
 *   force-closed AFTER enqueue() resolves, the record is already persisted and
 *   will be present the next time the app opens.  If force-closed DURING the
 *   await of enqueue(), the write may be lost — this is an inherent JS async
 *   limitation, not specific to IndexedDB.
 *
 * iOS Safari storage note:
 *   Apple classifies IndexedDB as "best effort" storage.  Under extreme storage
 *   pressure the OS may evict it.  Additionally, Safari enforces a 7-day
 *   inactivity eviction for SW-related caches (Cache Storage), but IndexedDB
 *   itself is NOT subject to the same automatic 7-day rule — it requires the
 *   user to explicitly clear site data or the OS to apply storage pressure.
 *   For a contributor who uses this tool regularly, eviction is unlikely.
 */

const DB_NAME    = 'arogya360_offline';
const DB_VERSION = 1;
const STORE_NAME = 'pending_reports';

// ── DB open (lazy singleton) ──────────────────────────────────────────────────

let _dbPromise = null;

function openDB() {
  if (_dbPromise) return _dbPromise;

  _dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);

    req.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        // keyPath = client_report_id so each record is uniquely keyed by its
        // idempotency UUID.  Attempting to enqueue the same UUID twice is a
        // no-op (the second put() overwrites, which is fine for our use case).
        db.createObjectStore(STORE_NAME, { keyPath: 'client_report_id' });
      }
    };

    req.onsuccess  = () => resolve(req.result);
    req.onerror    = () => {
      _dbPromise = null; // allow retry on next call
      reject(req.error);
    };
    req.onblocked  = () => {
      console.warn('[reportQueue] IndexedDB open blocked — another tab may hold an old version.');
    };
  });

  return _dbPromise;
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Add a submission to the offline queue.
 *
 * @param {object} payload  Full submission payload including client_report_id.
 * @returns {Promise<void>}
 */
export async function enqueue(payload) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx    = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const req   = store.put({
      ...payload,
      queued_at: new Date().toISOString(),
    });
    req.onsuccess = () => resolve();
    req.onerror   = () => reject(req.error);
  });
}

/**
 * Return all queued submissions, sorted by queued_at ascending (oldest first).
 *
 * @returns {Promise<object[]>}
 */
export async function getAllQueued() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx    = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const req   = store.getAll();
    req.onsuccess = () => {
      const records = req.result || [];
      records.sort((a, b) =>
        (a.queued_at || '').localeCompare(b.queued_at || ''),
      );
      resolve(records);
    };
    req.onerror = () => reject(req.error);
  });
}

/**
 * Remove a single queued submission by its client_report_id.
 * Called after a successful sync — including when the backend returns 200
 * (idempotent duplicate), which means it was already delivered.
 *
 * @param {string} clientReportId
 * @returns {Promise<void>}
 */
export async function removeQueued(clientReportId) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx    = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const req   = store.delete(clientReportId);
    req.onsuccess = () => resolve();
    req.onerror   = () => reject(req.error);
  });
}

/**
 * Return the count of items currently in the queue.
 *
 * @returns {Promise<number>}
 */
export async function queueCount() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx    = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const req   = store.count();
    req.onsuccess = () => resolve(req.result);
    req.onerror   = () => reject(req.error);
  });
}
