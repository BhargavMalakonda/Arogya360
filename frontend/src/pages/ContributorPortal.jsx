/**
 * ContributorPortal.jsx
 * ---------------------
 * Temporary test page for the contributor data-entry flow (Stage 2 + Stage 3).
 * Accessible at /contributor-portal (ProtectedRoute — must be signed in).
 * Role enforcement is at the API level; this page itself just requires login.
 *
 * Stage 3 additions:
 *  - Connectivity badge (Online / Offline)
 *  - Offline submission path: enqueues to IndexedDB instead of calling the API
 *  - Auto-sync via useOfflineSync (online event + visibilitychange + mount)
 *  - "PENDING SYNC — N report(s)" banner persists until all items sync
 *  - "N reports synced" confirmation replaces banner after successful flush
 *  - No false "submitted successfully" message when offline
 *
 * Uses the existing auth pattern: auth.currentUser.getIdToken() from lib/firebase.
 * Uses the existing API_BASE env var pattern.
 *
 * No Background Sync API is used anywhere in this file or its dependencies.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth } from '../lib/firebase';
import { enqueue } from '../lib/reportQueue';
import { useOfflineSync } from '../hooks/useOfflineSync';

const API_BASE = import.meta.env.VITE_API_BASE_URL;

// ── Constants ─────────────────────────────────────────────────────────────────
const CATEGORIES = [
  { value: 'respiratory',    label: 'Respiratory' },
  { value: 'cardiovascular', label: 'Cardiovascular' },
  { value: 'metabolic',      label: 'Metabolic' },
  { value: 'general',        label: 'General / Viral' },
];

const ESI_LEVELS = [1, 2, 3, 4, 5];

const ESI_LABELS = {
  1: 'ESI-1 — Resuscitation',
  2: 'ESI-2 — Emergent',
  3: 'ESI-3 — Urgent',
  4: 'ESI-4 — Less Urgent',
  5: 'ESI-5 — Non-Urgent',
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function generateClientReportId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function formatDate(isoStr) {
  if (!isoStr) return '—';
  try {
    return new Date(isoStr).toLocaleDateString('en-IN', {
      day: 'numeric', month: 'short', year: 'numeric',
    });
  } catch { return isoStr; }
}

// ── Auth-aware fetch (matches existing project pattern) ───────────────────────
async function apiFetch(path, options = {}) {
  const token = await auth.currentUser.getIdToken();
  return fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(options.headers || {}),
    },
  });
}

// ── Form initial state ────────────────────────────────────────────────────────
const EMPTY_FORM = {
  pincode:       '',
  category:      'respiratory',
  esi_level:     3,
  reported_date: today(),
  mode:          'individual',
  case_count:    '',
};

// ── Component ─────────────────────────────────────────────────────────────────
const ContributorPortal = () => {
  const navigate = useNavigate();

  // Form state
  const [form, setForm]               = useState(EMPTY_FORM);
  const [submitting, setSubmitting]   = useState(false);
  const [formError, setFormError]     = useState('');
  const [formSuccess, setFormSuccess] = useState('');
  const [queued, setQueued]           = useState(false); // true when last action was queued

  // Submissions list state
  const [reports, setReports]         = useState([]);
  const [listLoading, setListLoading] = useState(true);
  const [listError, setListError]     = useState('');

  // ── Load submissions ─────────────────────────────────────────────────────
  const loadReports = useCallback(async () => {
    setListLoading(true);
    setListError('');
    try {
      const res = await apiFetch('/api/reports');
      if (res.status === 403) {
        setListError('Access denied. This page is for contributors only.');
        return;
      }
      if (!res.ok) throw new Error(`Server error ${res.status}`);
      const data = await res.json();
      setReports(data.reports || []);
    } catch (err) {
      // If offline, the list just stays stale — not an error worth showing
      if (navigator.onLine) {
        console.error('[ContributorPortal] loadReports:', err.message);
        setListError('Could not load submissions. Please try again.');
      }
    } finally {
      setListLoading(false);
    }
  }, []);

  // Called by useOfflineSync after a successful sync batch
  const handleSyncSuccess = useCallback(async () => {
    await loadReports();
  }, [loadReports]);

  // ── Offline sync hook ────────────────────────────────────────────────────
  const { isOnline, pendingCount, syncMessage, refreshPending } =
    useOfflineSync(apiFetch, handleSyncSuccess);

  useEffect(() => { loadReports(); }, [loadReports]);

  // ── Form field change ─────────────────────────────────────────────────────
  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm(prev => ({
      ...prev,
      [name]: name === 'esi_level' || name === 'case_count'
        ? value === '' ? '' : Number(value)
        : value,
    }));
  };

  // ── Submit ────────────────────────────────────────────────────────────────
  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');
    setFormSuccess('');
    setQueued(false);

    if (!/^\d{6}$/.test(form.pincode)) {
      setFormError('Pincode must be exactly 6 digits.');
      return;
    }
    if (!form.case_count || form.case_count < 1) {
      setFormError('Case count must be at least 1.');
      return;
    }

    setSubmitting(true);

    const client_report_id = generateClientReportId();
    const payload = {
      client_report_id,
      pincode:       form.pincode,
      category:      form.category,
      esi_level:     Number(form.esi_level),
      reported_date: form.reported_date,
      mode:          form.mode,
      case_count:    Number(form.case_count),
      // uploader_uid / organization fields intentionally omitted —
      // the backend derives them from the authenticated token.
    };

    // ── Quick offline gate ────────────────────────────────────────────────
    // navigator.onLine is not fully reliable (captive portals, iOS quirks),
    // so this is a fast-path only.  If the device says it's offline, skip
    // the fetch entirely and go straight to the queue.  If it says online
    // but the fetch fails, the catch block below handles it.
    if (!navigator.onLine) {
      await _queuePayload(payload);
      setSubmitting(false);
      return;
    }

    // ── Attempt live submission ───────────────────────────────────────────
    try {
      const res = await apiFetch('/api/reports', {
        method: 'POST',
        body:   JSON.stringify(payload),
      });

      if (res.status === 403) {
        setFormError('Access denied. Only contributors can submit reports.');
        return;
      }
      if (res.status === 422) {
        const detail = await res.json();
        const msg = detail?.detail?.[0]?.msg || 'Validation error. Check your inputs.';
        setFormError(msg);
        return;
      }
      if (!res.ok) throw new Error(`Server error ${res.status}`);

      const created = await res.json();
      setFormSuccess(
        res.status === 200
          ? `Duplicate detected — existing report returned (ID: ${created.id}).`
          : `Report submitted (ID: ${created.id}).`,
      );
      setForm({ ...EMPTY_FORM, reported_date: today() });
      await loadReports();

    } catch {
      // The fetch failed (network dropped, server unreachable).
      // Queue the payload — do NOT show a success message.
      await _queuePayload(payload);
    } finally {
      setSubmitting(false);
    }
  };

  // ── Enqueue helper ────────────────────────────────────────────────────────
  const _queuePayload = async (payload) => {
    try {
      await enqueue(payload);
      await refreshPending();
      setQueued(true);
      setForm({ ...EMPTY_FORM, reported_date: today() });
    } catch (err) {
      console.error('[ContributorPortal] enqueue failed:', err);
      setFormError(
        'Could not save offline. Your report was not queued. ' +
        'Please try again when connected.',
      );
    }
  };

  // ── Derived banner content ────────────────────────────────────────────────
  const showPendingBanner = pendingCount > 0 && !syncMessage;
  const showSyncBanner    = Boolean(syncMessage);

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '24px 16px 80px' }}>

      {/* ── Connectivity + pending-sync banner ───────────────────────────── */}
      <div style={{ marginBottom: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>

        {/* Connectivity badge */}
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          padding: '4px 10px', borderRadius: 999, fontSize: 12, fontWeight: 600,
          width: 'fit-content',
          background: isOnline ? '#dcfce7' : '#fef9c3',
          color:      isOnline ? '#15803d' : '#854d0e',
          border:     `1px solid ${isOnline ? '#86efac' : '#fde047'}`,
        }}
          role="status"
          aria-live="polite"
        >
          <span style={{
            width: 7, height: 7, borderRadius: '50%',
            background: isOnline ? '#16a34a' : '#ca8a04',
            flexShrink: 0,
          }} aria-hidden="true" />
          {isOnline ? 'Online' : 'Offline'}
        </div>

        {/* Pending sync banner — shown while items are in the queue */}
        {showPendingBanner && (
          <div style={{
            padding: '8px 14px', borderRadius: 10, fontSize: 13, fontWeight: 500,
            background: '#fffbeb',
            border: '1px solid #fcd34d',
            color: '#92400e',
          }}
            role="status"
            aria-live="polite"
          >
            ⏳ You are offline.{' '}
            <strong>
              PENDING SYNC — {pendingCount} report{pendingCount !== 1 ? 's' : ''}
            </strong>
            {' '}saved locally. Will sync automatically when connected.
          </div>
        )}

        {/* Sync confirmation banner — shown briefly after a successful flush */}
        {showSyncBanner && (
          <div style={{
            padding: '8px 14px', borderRadius: 10, fontSize: 13, fontWeight: 500,
            background: '#f0fdf4',
            border: '1px solid #86efac',
            color: '#15803d',
          }}
            role="status"
            aria-live="polite"
          >
            ✓ {syncMessage}
          </div>
        )}

        {/* Queued-this-session message (clears when form is submitted again) */}
        {queued && !showPendingBanner && !showSyncBanner && (
          <div style={{
            padding: '8px 14px', borderRadius: 10, fontSize: 13,
            background: '#fffbeb', border: '1px solid #fcd34d', color: '#92400e',
          }}
            role="status"
          >
            Report saved locally. It will sync when you reconnect.
          </div>
        )}
      </div>

      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <button
          type="button"
          onClick={() => navigate('/home')}
          style={{ fontSize: 13, color: '#5856D6', background: 'none', border: 'none',
                   cursor: 'pointer', padding: 0, marginBottom: 10 }}
        >
          ← Back to Home
        </button>
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: '0 0 4px' }}>
          Contributor Portal
        </h1>
        <p style={{ fontSize: 13, color: '#64748b', margin: 0 }}>
          Stage 2/3 — submit ESI case reports, view your submissions.
        </p>
      </div>

      {/* ── Report ESI Cases form ─────────────────────────────────────────── */}
      <section style={cardStyle}>
        <h2 style={sectionHeading}>Report ESI Cases</h2>

        <form onSubmit={handleSubmit} noValidate>
          <div style={grid2}>
            {/* Pincode */}
            <div style={fieldWrap}>
              <label style={labelStyle} htmlFor="cp-pincode">Pincode *</label>
              <input
                id="cp-pincode" name="pincode" type="text"
                inputMode="numeric" maxLength={6} pattern="\d{6}" required
                value={form.pincode} onChange={handleChange}
                placeholder="6-digit pincode" style={inputStyle}
              />
            </div>

            {/* Category */}
            <div style={fieldWrap}>
              <label style={labelStyle} htmlFor="cp-category">Category *</label>
              <select
                id="cp-category" name="category"
                value={form.category} onChange={handleChange} style={inputStyle}
              >
                {CATEGORIES.map(c => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
            </div>

            {/* Reporting date */}
            <div style={fieldWrap}>
              <label style={labelStyle} htmlFor="cp-date">Reporting Date *</label>
              <input
                id="cp-date" name="reported_date" type="date" required
                value={form.reported_date} onChange={handleChange} style={inputStyle}
              />
            </div>

            {/* Case count */}
            <div style={fieldWrap}>
              <label style={labelStyle} htmlFor="cp-count">Case Count *</label>
              <input
                id="cp-count" name="case_count" type="number" min={1} required
                value={form.case_count} onChange={handleChange}
                placeholder="e.g. 5" style={inputStyle}
              />
            </div>
          </div>

          {/* ESI Level */}
          <div style={{ ...fieldWrap, marginTop: 10 }}>
            <p style={{ ...labelStyle, marginBottom: 6 }}>ESI Level *</p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 16px' }}>
              {ESI_LEVELS.map(lvl => (
                <label key={lvl}
                  style={{ display: 'flex', alignItems: 'center', gap: 6,
                           fontSize: 13, cursor: 'pointer' }}>
                  <input type="radio" name="esi_level" value={lvl}
                    checked={form.esi_level === lvl} onChange={handleChange} />
                  {ESI_LABELS[lvl]}
                </label>
              ))}
            </div>
          </div>

          {/* Mode */}
          <div style={{ ...fieldWrap, marginTop: 10 }}>
            <p style={{ ...labelStyle, marginBottom: 6 }}>Reporting Mode *</p>
            <div style={{ display: 'flex', gap: 20 }}>
              {['individual', 'bulk'].map(m => (
                <label key={m}
                  style={{ display: 'flex', alignItems: 'center', gap: 6,
                           fontSize: 13, cursor: 'pointer' }}>
                  <input type="radio" name="mode" value={m}
                    checked={form.mode === m} onChange={handleChange} />
                  {m.charAt(0).toUpperCase() + m.slice(1)}
                </label>
              ))}
            </div>
          </div>

          {/* Feedback */}
          {formError && (
            <p style={{ color: '#dc2626', fontSize: 13, marginTop: 8 }} role="alert">
              {formError}
            </p>
          )}
          {formSuccess && (
            <p style={{ color: '#15803d', fontSize: 13, marginTop: 8 }} role="status">
              {formSuccess}
            </p>
          )}

          <button type="submit" disabled={submitting} style={submitBtn}>
            {submitting
              ? 'Submitting…'
              : isOnline ? 'Submit Report' : 'Save Offline'}
          </button>
        </form>
      </section>

      {/* ── My Submissions list ───────────────────────────────────────────── */}
      <section style={{ ...cardStyle, marginTop: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between',
                      alignItems: 'center', marginBottom: 16 }}>
          <h2 style={{ ...sectionHeading, marginBottom: 0 }}>My Submissions</h2>
          <button type="button" onClick={loadReports} disabled={listLoading}
            style={{ fontSize: 12, color: '#5856D6', background: 'none',
                     border: 'none', cursor: 'pointer', padding: 0 }}>
            {listLoading ? 'Loading…' : 'Refresh'}
          </button>
        </div>

        {!isOnline && (
          <p style={{ fontSize: 12, color: '#92400e', marginBottom: 8 }}>
            Showing cached list — connect to see latest server data.
          </p>
        )}

        {listError && (
          <p style={{ color: '#dc2626', fontSize: 13 }} role="alert">{listError}</p>
        )}

        {!listLoading && !listError && reports.length === 0 && (
          <p style={{ fontSize: 13, color: '#64748b' }}>
            No synced submissions yet.
          </p>
        )}

        {reports.length > 0 && (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #e2e8f0', textAlign: 'left' }}>
                  {['Pincode','Category','ESI','Cases','Mode','Date','Status'].map(h => (
                    <th key={h} style={thStyle}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {reports.map((r, i) => (
                  <tr key={r.id}
                    style={{ background: i % 2 === 0 ? '#fff' : '#f8fafc',
                             borderBottom: '1px solid #f1f5f9' }}>
                    <td style={tdStyle}>{r.pincode}</td>
                    <td style={tdStyle}>{r.category}</td>
                    <td style={tdStyle}>ESI-{r.esi_level}</td>
                    <td style={tdStyle}>{r.case_count}</td>
                    <td style={tdStyle}>{r.mode}</td>
                    <td style={tdStyle}>{formatDate(r.reported_date)}</td>
                    <td style={tdStyle}>
                      <span style={{
                        display: 'inline-block', padding: '2px 8px',
                        borderRadius: 999, fontSize: 11, fontWeight: 600,
                        background: r.status === 'active' ? '#dcfce7' : '#f1f5f9',
                        color:      r.status === 'active' ? '#15803d' : '#475569',
                      }}>
                        {r.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
};

// ── Inline styles ─────────────────────────────────────────────────────────────
const cardStyle = {
  background: 'rgba(255,255,255,0.90)',
  border: '1px solid #e2e8f0',
  borderRadius: 16,
  padding: '20px 20px 24px',
  boxShadow: '0 2px 12px rgba(88,86,214,0.07)',
};
const sectionHeading = { fontSize: 16, fontWeight: 700, margin: '0 0 16px', color: '#1e1f3b' };
const grid2 = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 };
const fieldWrap  = { display: 'flex', flexDirection: 'column', gap: 4 };
const labelStyle = { fontSize: 12, fontWeight: 600, color: '#475569', margin: 0 };
const inputStyle = {
  fontSize: 14, padding: '8px 10px', border: '1px solid #cbd5e1',
  borderRadius: 8, outline: 'none', width: '100%', boxSizing: 'border-box', background: '#fff',
};
const submitBtn = {
  marginTop: 16, padding: '10px 24px',
  background: 'linear-gradient(135deg,#706DF2,#5856D6)',
  color: '#fff', fontSize: 14, fontWeight: 600,
  border: 'none', borderRadius: 10, cursor: 'pointer',
};
const thStyle = { padding: '6px 10px', fontWeight: 600, color: '#475569', whiteSpace: 'nowrap' };
const tdStyle = { padding: '8px 10px', color: '#334155', whiteSpace: 'nowrap' };

export default ContributorPortal;
