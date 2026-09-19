/**
 * SubmissionsPage.jsx  —  /dashboard/submissions
 * ------------------------------------------------
 * Displays the contributor's synced health-report submissions.
 *
 * Stage 8 additions:
 *   - Flagged reports show a distinct amber banner:
 *     "Government has requested verification"
 *   - Two action buttons per flagged report:
 *       Correct Report  → opens inline form with new case count
 *       Confirm Report  → confirms original count is correct
 *   - Both call POST /api/corrections/respond
 *   - Status badges: active (green) / flagged (amber) / corrected (blue) /
 *     confirmed (purple)
 *   - Existing offline/pending-sync banners, online badge, loadReports
 *     behavior are all unchanged.
 */

import React, { useCallback, useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { auth } from '../../lib/firebase';

const API_BASE = import.meta.env.VITE_API_BASE_URL;

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

function formatDate(isoStr) {
  if (!isoStr) return '—';
  try {
    return new Date(isoStr).toLocaleDateString('en-IN', {
      day: 'numeric', month: 'short', year: 'numeric',
    });
  } catch { return isoStr; }
}

// ── Status badge ──────────────────────────────────────────────────────────────
const STATUS_CFG = {
  active:    { bg: '#dcfce7', color: '#15803d' },
  flagged:   { bg: '#fef9c3', color: '#92400e' },
  corrected: { bg: '#dbeafe', color: '#1d4ed8' },
  confirmed: { bg: '#ede9fe', color: '#6d28d9' },
};
const StatusBadge = ({ status }) => {
  const cfg = STATUS_CFG[status] || { bg: '#f1f5f9', color: '#475569' };
  return (
    <span style={{
      display: 'inline-block', padding: '2px 8px', borderRadius: 999,
      fontSize: 11, fontWeight: 600, textTransform: 'capitalize',
      background: cfg.bg, color: cfg.color,
    }}>{status}</span>
  );
};

// ── Correction inline form ────────────────────────────────────────────────────
const CorrectionForm = ({ report, onDone, onCancel }) => {
  const [mode,         setMode]         = useState(null); // 'correct' | 'confirm'
  const [newCount,     setNewCount]     = useState('');
  const [submitting,   setSubmitting]   = useState(false);
  const [error,        setError]        = useState('');

  const handleSubmit = async () => {
    if (mode === 'correct' && (!newCount || Number(newCount) < 1)) {
      setError('Please enter a valid case count (minimum 1).');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      const body = {
        report_id: report.id,
        response:  mode === 'correct' ? 'corrected' : 'confirmed',
        ...(mode === 'correct' ? { new_case_count: Number(newCount) } : {}),
      };
      const res = await apiFetch('/api/corrections/respond', {
        method: 'POST',
        body:   JSON.stringify(body),
      });
      if (res.status === 403) { setError('Access denied.'); return; }
      if (res.status === 409) {
        const d = await res.json();
        setError(d.detail || 'This report cannot be updated in its current state.');
        return;
      }
      if (!res.ok) throw new Error(`Server error ${res.status}`);
      onDone();
    } catch (err) {
      console.error('[SubmissionsPage] respond:', err.message);
      setError('Could not submit. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!mode) {
    return (
      <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
        <button type="button" onClick={() => setMode('correct')} style={correctBtn}>
          ✏ Correct Report
        </button>
        <button type="button" onClick={() => setMode('confirm')} style={confirmBtn}>
          ✓ Confirm Report
        </button>
      </div>
    );
  }

  return (
    <div style={{ marginTop: 10, padding: '10px 12px', borderRadius: 8, background: '#f8fafc', border: '1px solid #e2e8f0' }}>
      {mode === 'correct' ? (
        <>
          <p style={{ fontSize: 12, fontWeight: 600, color: '#1e1f3b', margin: '0 0 6px' }}>
            Enter the correct case count:
          </p>
          <input
            type="number"
            min={1}
            value={newCount}
            onChange={e => setNewCount(e.target.value)}
            placeholder="e.g. 3"
            style={{ fontSize: 13, padding: '5px 8px', borderRadius: 6, border: '1px solid #cbd5e1', width: 100 }}
          />
        </>
      ) : (
        <p style={{ fontSize: 12, color: '#475569', margin: '0 0 6px' }}>
          Confirm that the original count of <strong>{report.case_count}</strong> case{report.case_count !== 1 ? 's' : ''} is correct?
        </p>
      )}
      {error && <p style={{ fontSize: 12, color: '#dc2626', margin: '4px 0 0' }} role="alert">{error}</p>}
      <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
        <button type="button" onClick={handleSubmit} disabled={submitting} style={{ ...correctBtn, opacity: submitting ? 0.7 : 1 }}>
          {submitting ? 'Submitting…' : 'Submit'}
        </button>
        <button type="button" onClick={() => { setMode(null); setError(''); onCancel(); }} style={cancelBtn}>
          Cancel
        </button>
      </div>
    </div>
  );
};

// ── Component ─────────────────────────────────────────────────────────────────
const SubmissionsPage = () => {
  const {
    isOnline, pendingCount, syncMessage,
    reports, listLoading, listError, loadReports,
  } = useOutletContext();

  const [respondingId, setRespondingId] = useState(null); // report.id being responded to

  useEffect(() => { loadReports(); }, [loadReports]);

  const showPendingBanner = pendingCount > 0 && !syncMessage;
  const showSyncBanner    = Boolean(syncMessage);

  const handleResponseDone = useCallback(async () => {
    setRespondingId(null);
    await loadReports();
  }, [loadReports]);

  return (
    <div>
      {/* ── Connectivity / offline banners ────────────────────────────────── */}
      <div style={{ marginBottom: 14, display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          padding: '4px 10px', borderRadius: 999, fontSize: 12, fontWeight: 600,
          width: 'fit-content',
          background: isOnline ? '#dcfce7' : '#fef9c3',
          color:      isOnline ? '#15803d' : '#854d0e',
          border:     `1px solid ${isOnline ? '#86efac' : '#fde047'}`,
        }} role="status" aria-live="polite">
          <span style={{ width: 7, height: 7, borderRadius: '50%', background: isOnline ? '#16a34a' : '#ca8a04', flexShrink: 0 }} aria-hidden="true" />
          {isOnline ? 'Online' : 'Offline'}
        </div>

        {showPendingBanner && (
          <div style={{ padding: '8px 14px', borderRadius: 10, fontSize: 13, fontWeight: 500, background: '#fffbeb', border: '1px solid #fcd34d', color: '#92400e' }} role="status" aria-live="polite">
            ⏳ <strong>PENDING SYNC — {pendingCount} report{pendingCount !== 1 ? 's' : ''}</strong>
            {' '}not yet delivered to the server.
          </div>
        )}

        {showSyncBanner && (
          <div style={{ padding: '8px 14px', borderRadius: 10, fontSize: 13, fontWeight: 500, background: '#f0fdf4', border: '1px solid #86efac', color: '#15803d' }} role="status" aria-live="polite">
            ✓ {syncMessage}
          </div>
        )}
      </div>

      {/* ── Submissions list ──────────────────────────────────────────────── */}
      <section style={cardStyle}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h2 style={{ ...sectionHeading, marginBottom: 0 }}>My Submissions</h2>
          <button type="button" onClick={loadReports} disabled={listLoading}
            style={{ fontSize: 12, color: '#5856D6', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
            {listLoading ? 'Loading…' : 'Refresh'}
          </button>
        </div>

        {!isOnline && (
          <p style={{ fontSize: 12, color: '#92400e', marginBottom: 8 }}>
            Showing cached list — connect to see latest server data.
          </p>
        )}

        {listError && <p style={{ color: '#dc2626', fontSize: 13 }} role="alert">{listError}</p>}

        {!listLoading && !listError && reports.length === 0 && (
          <p style={{ fontSize: 13, color: '#64748b' }}>
            No synced submissions yet. Go to Entry to submit a report.
          </p>
        )}

        {reports.length > 0 && reports.map((r, i) => (
          <div key={r.id}
            style={{
              borderBottom: i < reports.length - 1 ? '1px solid #f1f5f9' : 'none',
              padding: '10px 0',
              background: r.status === 'flagged' ? 'rgba(254,243,199,0.35)' : 'transparent',
            }}
          >
            {/* ── Flagged banner ──────────────────────────────────────────── */}
            {r.status === 'flagged' && (
              <div style={{
                padding: '8px 12px', borderRadius: 8, marginBottom: 8,
                background: '#fef9c3', border: '1px solid #fcd34d',
                display: 'flex', alignItems: 'flex-start', gap: 8,
              }} role="alert">
                <span style={{ fontSize: 15, flexShrink: 0 }}>⚠</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 12, fontWeight: 700, color: '#92400e', margin: '0 0 2px' }}>
                    Government has requested verification
                  </p>
                  <p style={{ fontSize: 11, color: '#92400e', margin: 0 }}>
                    A health official has flagged this report. Please correct or confirm the data below.
                  </p>
                </div>
              </div>
            )}

            {/* ── Report data row ──────────────────────────────────────────── */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(90px,1fr))', gap: '4px 12px', fontSize: 12 }}>
              <div><span style={labelSt}>Pincode</span><span style={valueSt}>{r.pincode}</span></div>
              <div><span style={labelSt}>Category</span><span style={valueSt}>{r.category}</span></div>
              <div><span style={labelSt}>ESI</span><span style={valueSt}>ESI-{r.esi_level}</span></div>
              <div><span style={labelSt}>Cases</span><span style={{ ...valueSt, fontWeight: 700 }}>{r.case_count}</span></div>
              <div><span style={labelSt}>Mode</span><span style={valueSt}>{r.mode}</span></div>
              <div><span style={labelSt}>Date</span><span style={valueSt}>{formatDate(r.reported_date)}</span></div>
              <div><span style={labelSt}>Status</span><StatusBadge status={r.status} /></div>
            </div>

            {/* ── Correction response form (flagged only) ──────────────────── */}
            {r.status === 'flagged' && respondingId !== r.id && (
              <div style={{ marginTop: 8 }}>
                <button type="button" onClick={() => setRespondingId(r.id)}
                  style={{ fontSize: 12, fontWeight: 600, color: '#5856D6', background: 'rgba(88,86,214,0.07)', border: '1px solid rgba(88,86,214,0.20)', borderRadius: 7, padding: '4px 12px', cursor: 'pointer' }}>
                  Respond to Flag →
                </button>
              </div>
            )}

            {r.status === 'flagged' && respondingId === r.id && (
              <CorrectionForm
                report={r}
                onDone={handleResponseDone}
                onCancel={() => setRespondingId(null)}
              />
            )}
          </div>
        ))}
      </section>
    </div>
  );
};

// ── Styles ────────────────────────────────────────────────────────────────────
const cardStyle = {
  background: 'rgba(255,255,255,0.90)', border: '1px solid #e2e8f0',
  borderRadius: 16, padding: '20px 20px 24px',
  boxShadow: '0 2px 12px rgba(88,86,214,0.07)',
};
const sectionHeading = { fontSize: 16, fontWeight: 700, margin: '0 0 16px', color: '#1e1f3b' };
const labelSt = { display: 'block', fontSize: 10, fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 2 };
const valueSt = { display: 'block', fontSize: 12, color: '#334155' };
const correctBtn = { fontSize: 12, fontWeight: 600, color: '#fff', background: '#5856D6', border: 'none', borderRadius: 7, padding: '6px 12px', cursor: 'pointer' };
const confirmBtn = { fontSize: 12, fontWeight: 600, color: '#15803d', background: '#dcfce7', border: '1px solid #86efac', borderRadius: 7, padding: '6px 12px', cursor: 'pointer' };
const cancelBtn  = { fontSize: 12, fontWeight: 600, color: '#475569', background: '#fff', border: '1px solid #e2e8f0', borderRadius: 7, padding: '6px 12px', cursor: 'pointer' };

export default SubmissionsPage;
