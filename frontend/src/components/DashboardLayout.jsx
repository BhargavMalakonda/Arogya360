/**
 * DashboardLayout.jsx
 * -------------------
 * Shell for all /dashboard/* routes.
 *
 * Responsibilities:
 *   - Own header: Arogya360 name, org name, role badge, logout
 *   - Tab navigation scoped to the current role
 *   - Holds the shared offline-sync state (useOfflineSync) so both
 *     EntryPage and SubmissionsPage share the same pendingCount/isOnline
 *     without mounting two separate hook instances
 *   - Exposes shared state to child routes via React Router Outlet context
 *
 * No TopBar. No BottomNav. Completely separate from the patient-facing Layout.
 *
 * Stage 3 preservation:
 *   useOfflineSync and reportQueue are NOT changed. This component simply
 *   mounts the hook once and passes the result down to child pages.
 *   The offline queue, pending banner, and sync logic remain intact.
 *   Known Stage 3 issue: offline hard-refresh (Ctrl+Shift+R) still fails —
 *   this is a browser-spec limitation documented in Stage 3 and not fixed here.
 */

import React, { useCallback, useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { auth } from '../lib/firebase';
import { useOfflineSync } from '../hooks/useOfflineSync';

const API_BASE = import.meta.env.VITE_API_BASE_URL;

// Auth-aware fetch — same pattern as ContributorPortal/Triage
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

// ── Tab configs per role ──────────────────────────────────────────────────────
const CONTRIBUTOR_TABS = [
  { to: '/dashboard/entry',       label: 'Entry'          },
  { to: '/dashboard/submissions', label: 'My Submissions' },
];
const OFFICIAL_TABS = [
  { to: '/dashboard/heatmap', label: 'Heatmap' },
];

const DashboardLayout = () => {
  const { userProfile, logout } = useAuth();
  const navigate = useNavigate();

  const role    = userProfile?.role            || '';
  const orgName = userProfile?.organization_name || '';
  const tabs    = role === 'contributor' ? CONTRIBUTOR_TABS
                : role === 'health_official' ? OFFICIAL_TABS
                : [];

  // ── Shared submissions list state ─────────────────────────────────────────
  // Lifted here so EntryPage can trigger a refresh after a successful submit
  // and SubmissionsPage reads the same list without re-fetching on every mount.
  const [reports, setReports]         = useState([]);
  const [listLoading, setListLoading] = useState(false);
  const [listError, setListError]     = useState('');

  const loadReports = useCallback(async () => {
    setListLoading(true);
    setListError('');
    try {
      const res = await apiFetch('/api/reports');
      if (res.status === 403) {
        setListError('Access denied. This section is for contributors only.');
        return;
      }
      if (!res.ok) throw new Error(`Server error ${res.status}`);
      const data = await res.json();
      setReports(data.reports || []);
    } catch (err) {
      if (navigator.onLine) {
        console.error('[DashboardLayout] loadReports:', err.message);
        setListError('Could not load submissions. Please try again.');
      }
    } finally {
      setListLoading(false);
    }
  }, []);

  // Called by useOfflineSync after a successful sync batch — refreshes the list
  const handleSyncSuccess = useCallback(async () => {
    await loadReports();
  }, [loadReports]);

  // ── Offline sync hook — ONE instance for the whole dashboard ──────────────
  const { isOnline, pendingCount, syncMessage, refreshPending } =
    useOfflineSync(apiFetch, handleSyncSuccess);

  const handleLogout = () => {
    logout();
    navigate('/auth', { replace: true });
  };

  // Outlet context shape — passed to all child routes
  const outletCtx = {
    apiFetch,
    isOnline,
    pendingCount,
    syncMessage,
    refreshPending,
    reports,
    listLoading,
    listError,
    loadReports,
  };

  return (
    <div style={{ minHeight: '100vh', background: '#F8F9FF', display: 'flex', flexDirection: 'column' }}>

      {/* ── Dashboard header ──────────────────────────────────────────────── */}
      <header style={{
        position: 'sticky', top: 0, zIndex: 50,
        background: 'rgba(255,255,255,0.90)',
        backdropFilter: 'blur(16px)',
        borderBottom: '1px solid rgba(226,232,240,0.80)',
      }}>
        <div style={{
          maxWidth: 960, margin: '0 auto',
          padding: '0 16px',
          height: 56,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          {/* Left: app name */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 28, height: 28, borderRadius: 8,
              background: 'linear-gradient(135deg,#706DF2,#5856D6)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#fff', fontSize: 13, fontWeight: 700,
              flexShrink: 0,
            }}>A</div>
            <span style={{ fontSize: 15, fontWeight: 700, color: '#1e1f3b' }}>
              Arogya360
            </span>
            {orgName && (
              <span style={{
                fontSize: 11, color: '#64748b',
                paddingLeft: 8,
                borderLeft: '1px solid #e2e8f0',
                marginLeft: 2,
              }}>
                {orgName}
              </span>
            )}
          </div>

          {/* Right: role badge + logout */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {role && (
              <span style={{
                fontSize: 11, fontWeight: 600,
                padding: '3px 9px', borderRadius: 999,
                background: role === 'health_official' ? '#ede9fe' : 'rgba(88,86,214,0.09)',
                color:      role === 'health_official' ? '#6d28d9' : '#4338ca',
                border:     `1px solid ${role === 'health_official' ? '#c4b5fd' : 'rgba(88,86,214,0.20)'}`,
                textTransform: 'capitalize',
              }}>
                {role === 'health_official' ? 'Health Official' : 'Contributor'}
              </span>
            )}
            <button
              type="button"
              onClick={handleLogout}
              style={{
                fontSize: 12, fontWeight: 600,
                padding: '4px 12px', borderRadius: 8,
                background: 'transparent',
                border: '1px solid #e2e8f0',
                color: '#64748b',
                cursor: 'pointer',
              }}
            >
              Log out
            </button>
          </div>
        </div>

        {/* Tab navigation */}
        {tabs.length > 0 && (
          <div style={{
            maxWidth: 960, margin: '0 auto',
            padding: '0 16px',
            display: 'flex', gap: 4,
            borderTop: '1px solid rgba(226,232,240,0.50)',
          }}>
            {tabs.map(({ to, label }) => (
              <NavLink
                key={to}
                to={to}
                style={({ isActive }) => ({
                  display: 'inline-block',
                  padding: '8px 14px',
                  fontSize: 13, fontWeight: 600,
                  textDecoration: 'none',
                  borderBottom: isActive ? '2px solid #5856D6' : '2px solid transparent',
                  color: isActive ? '#5856D6' : '#64748b',
                  transition: 'color 150ms, border-color 150ms',
                })}
              >
                {label}
              </NavLink>
            ))}
          </div>
        )}
      </header>

      {/* ── Page content ────────────────────────────────────────────────────── */}
      <main style={{ flex: 1, maxWidth: 960, margin: '0 auto', width: '100%', padding: '20px 16px 48px' }}>
        <Outlet context={outletCtx} />
      </main>
    </div>
  );
};

export default DashboardLayout;
