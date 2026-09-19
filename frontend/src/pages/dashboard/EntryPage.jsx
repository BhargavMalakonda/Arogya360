/**
 * EntryPage.jsx  —  /dashboard/entry
 * ------------------------------------
 * Contributor ESI case entry form.
 *
 * This is the form section of the former ContributorPortal, moved into the
 * /dashboard route area.  All Stage 3 offline behavior is preserved:
 *   - navigator.onLine quick gate
 *   - Falls back to IndexedDB queue on network failure (via enqueue())
 *   - Pending banner and sync message come from DashboardLayout's shared
 *     useOfflineSync instance — no second hook, no duplicate state
 *   - client_report_id is generated here, stable per submission attempt
 *
 * Receives shared state from DashboardLayout via React Router Outlet context.
 *
 * Known Stage 3 issue: offline hard-refresh (Ctrl+Shift+R) fails — this is
 * a browser-spec behavior, documented in Stage 3, not addressed here.
 */

import React, { useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { enqueue } from '../../lib/reportQueue';

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

function generateClientReportId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

const EMPTY_FORM = {
  pincode:       '',
  category:      'respiratory',
  esi_level:     3,
  reported_date: today(),
  mode:          'individual',
  case_count:    '',
};

const EntryPage = () => {
  // Shared offline state from DashboardLayout (single useOfflineSync instance)
  const { apiFetch, isOnline, pendingCount, syncMessage, refreshPending, loadReports } =
    useOutletContext();

  const [form, setForm]               = useState(EMPTY_FORM);
  const [submitting, setSubmitting]   = useState(false);
  const [formError, setFormError]     = useState('');
  const [formSuccess, setFormSuccess] = useState('');
  const [queued, setQueued]           = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm(prev => ({
      ...prev,
      [name]: name === 'esi_level' || name === 'case_count'
        ? value === '' ? '' : Number(value)
        : value,
    }));
  };

  const _queuePayload = async (payload) => {
    try {
      await enqueue(payload);
      await refreshPending();
      setQueued(true);
      setForm({ ...EMPTY_FORM, reported_date: today() });
    } catch (err) {
      console.error('[EntryPage] enqueue failed:', err);
      setFormError(
        'Could not save offline. Your report was not queued. ' +
        'Please try again when connected.',
      );
    }
  };

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
    };

    // Quick offline gate (navigator.onLine is a hint, not guaranteed)
    if (!navigator.onLine) {
      await _queuePayload(payload);
      setSubmitting(false);
      return;
    }

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
      await loadReports();     // refresh the shared submissions list

    } catch {
      // Network failure — queue, do NOT show a success message
      await _queuePayload(payload);
    } finally {
      setSubmitting(false);
    }
  };

  const showPendingBanner = pendingCount > 0 && !syncMessage;
  const showSyncBanner    = Boolean(syncMessage);

  return (
    <div>
      {/* ── Connectivity + sync banners ───────────────────────────────────── */}
      <div style={{ marginBottom: 14, display: 'flex', flexDirection: 'column', gap: 6 }}>
        {/* Connectivity badge */}
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          padding: '4px 10px', borderRadius: 999, fontSize: 12, fontWeight: 600,
          width: 'fit-content',
          background: isOnline ? '#dcfce7' : '#fef9c3',
          color:      isOnline ? '#15803d' : '#854d0e',
          border:     `1px solid ${isOnline ? '#86efac' : '#fde047'}`,
        }} role="status" aria-live="polite">
          <span style={{
            width: 7, height: 7, borderRadius: '50%',
            background: isOnline ? '#16a34a' : '#ca8a04', flexShrink: 0,
          }} aria-hidden="true" />
          {isOnline ? 'Online' : 'Offline'}
        </div>

        {/* Pending sync banner */}
        {showPendingBanner && (
          <div style={{
            padding: '8px 14px', borderRadius: 10, fontSize: 13, fontWeight: 500,
            background: '#fffbeb', border: '1px solid #fcd34d', color: '#92400e',
          }} role="status" aria-live="polite">
            ⏳ You are offline.{' '}
            <strong>PENDING SYNC — {pendingCount} report{pendingCount !== 1 ? 's' : ''}</strong>
            {' '}saved locally. Will sync automatically when connected.
          </div>
        )}

        {/* Sync confirmation */}
        {showSyncBanner && (
          <div style={{
            padding: '8px 14px', borderRadius: 10, fontSize: 13, fontWeight: 500,
            background: '#f0fdf4', border: '1px solid #86efac', color: '#15803d',
          }} role="status" aria-live="polite">
            ✓ {syncMessage}
          </div>
        )}

        {/* Queued-this-session notice */}
        {queued && !showPendingBanner && !showSyncBanner && (
          <div style={{
            padding: '8px 14px', borderRadius: 10, fontSize: 13,
            background: '#fffbeb', border: '1px solid #fcd34d', color: '#92400e',
          }} role="status">
            Report saved locally. It will sync when you reconnect.
          </div>
        )}
      </div>

      {/* ── Form card ─────────────────────────────────────────────────────── */}
      <section style={cardStyle}>
        <h2 style={sectionHeading}>Report ESI Cases</h2>
        <form onSubmit={handleSubmit} noValidate>
          <div style={grid2}>
            <div style={fieldWrap}>
              <label style={labelStyle} htmlFor="ep-pincode">Pincode *</label>
              <input id="ep-pincode" name="pincode" type="text" inputMode="numeric"
                maxLength={6} pattern="\d{6}" required
                value={form.pincode} onChange={handleChange}
                placeholder="6-digit pincode" style={inputStyle} />
            </div>

            <div style={fieldWrap}>
              <label style={labelStyle} htmlFor="ep-category">Category *</label>
              <select id="ep-category" name="category"
                value={form.category} onChange={handleChange} style={inputStyle}>
                {CATEGORIES.map(c => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
            </div>

            <div style={fieldWrap}>
              <label style={labelStyle} htmlFor="ep-date">Reporting Date *</label>
              <input id="ep-date" name="reported_date" type="date" required
                value={form.reported_date} onChange={handleChange} style={inputStyle} />
            </div>

            <div style={fieldWrap}>
              <label style={labelStyle} htmlFor="ep-count">Case Count *</label>
              <input id="ep-count" name="case_count" type="number" min={1} required
                value={form.case_count} onChange={handleChange}
                placeholder="e.g. 5" style={inputStyle} />
            </div>
          </div>

          {/* ESI Level */}
          <div style={{ ...fieldWrap, marginTop: 10 }}>
            <p style={{ ...labelStyle, marginBottom: 6 }}>ESI Level *</p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 16px' }}>
              {ESI_LEVELS.map(lvl => (
                <label key={lvl} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, cursor: 'pointer' }}>
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
                <label key={m} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, cursor: 'pointer' }}>
                  <input type="radio" name="mode" value={m}
                    checked={form.mode === m} onChange={handleChange} />
                  {m.charAt(0).toUpperCase() + m.slice(1)}
                </label>
              ))}
            </div>
          </div>

          {formError && <p style={{ color: '#dc2626', fontSize: 13, marginTop: 8 }} role="alert">{formError}</p>}
          {formSuccess && <p style={{ color: '#15803d', fontSize: 13, marginTop: 8 }} role="status">{formSuccess}</p>}

          <button type="submit" disabled={submitting} style={submitBtn}>
            {submitting ? 'Submitting…' : isOnline ? 'Submit Report' : 'Save Offline'}
          </button>
        </form>
      </section>
    </div>
  );
};

// ── Inline styles ─────────────────────────────────────────────────────────────
const cardStyle = {
  background: 'rgba(255,255,255,0.90)', border: '1px solid #e2e8f0',
  borderRadius: 16, padding: '20px 20px 24px',
  boxShadow: '0 2px 12px rgba(88,86,214,0.07)',
};
const sectionHeading = { fontSize: 16, fontWeight: 700, margin: '0 0 16px', color: '#1e1f3b' };
const grid2 = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 12 };
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

export default EntryPage;
