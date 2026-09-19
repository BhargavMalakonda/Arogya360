import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Layout from './components/Layout';
import DashboardLayout from './components/DashboardLayout';
import Auth from './pages/Auth';
import Onboarding from './pages/Onboarding';
import Home from './pages/Home';
import Triage from './pages/Triage';
import Result from './pages/Result';
import History from './pages/History';
import HistoryDetail from './pages/HistoryDetail';
import Profile from './pages/Profile';
import KidsZone from './pages/KidsZone';
import CureAI from './pages/CureAI';
import PublicSummary from './pages/PublicSummary';
import FindCare from './pages/FindCare';
import EntryPage from './pages/dashboard/EntryPage';
import SubmissionsPage from './pages/dashboard/SubmissionsPage';
import HeatmapPage from './pages/dashboard/HeatmapPage';

// ── Role-based default routes ─────────────────────────────────────────────────
function roleDefault(role) {
  if (role === 'contributor')     return '/dashboard/entry';
  if (role === 'health_official') return '/dashboard/heatmap';
  return '/home';
}

// ── RoleRoute — per-route role guard inside /dashboard ────────────────────────
// Wraps a single dashboard child route element.
// DashboardRoute (the parent) has already resolved loading and auth before
// any child route renders, so userProfile is guaranteed non-null here.
// If the current role is not in allowedRoles, redirect to that role's default.
const RoleRoute = ({ allowedRoles, children }) => {
  const { userProfile } = useAuth();
  const role = userProfile?.role || '';
  if (!allowedRoles.includes(role)) {
    return <Navigate to={roleDefault(role)} replace />;
  }
  return children;
};

// ── ProtectedRoute — requires authentication ──────────────────────────────────
const ProtectedRoute = ({ children, showBottomNav = true, showTopBar = true }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <Layout showTopBar={showTopBar} showBottomNav={showBottomNav}>
        <div className="flex items-center justify-center h-16">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500" />
        </div>
      </Layout>
    );
  }

  if (!user) return <Navigate to="/auth" replace />;

  return (
    <Layout showTopBar={showTopBar} showBottomNav={showBottomNav}>
      {children}
    </Layout>
  );
};

// ── DashboardRoute — authenticated + specific role(s) ─────────────────────────
// Renders DashboardLayout directly (no patient Layout/TopBar/BottomNav).
// If not authenticated → /auth.
// If authenticated but wrong role → redirect to their own default route.
const DashboardRoute = ({ requiredRoles }) => {
  const { user, userProfile, loading } = useAuth();

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500" />
      </div>
    );
  }

  if (!user) return <Navigate to="/auth" replace />;

  const role = userProfile?.role || '';

  // Profile not yet loaded (null) — wait (show nothing, loading already false)
  // This handles the edge case where userProfile hasn't resolved yet.
  if (userProfile === null && user) {
    // Still loading profile? AuthContext sets loading:false before setting profile.
    // If userProfile is null after loading:false, the user has no Firestore doc.
    // Dashboard users always have a profile — redirect to onboarding.
    return <Navigate to="/onboarding" replace />;
  }

  if (!requiredRoles.includes(role)) {
    // Wrong role — redirect to the user's correct default
    return <Navigate to={roleDefault(role)} replace />;
  }

  return <DashboardLayout />;
};

// ── IndexRedirect — post-login routing ───────────────────────────────────────
// Role-aware: contributors and health officials land on their dashboard default.
// Normal patient users land on /home as before.
const IndexRedirect = () => {
  const { user, userProfile, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-16">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500" />
      </div>
    );
  }

  if (!user)        return <Navigate to="/auth" replace />;
  if (!userProfile) return <Navigate to="/onboarding" replace />;

  // Role-aware redirect
  const role = userProfile.role || '';
  return <Navigate to={roleDefault(role)} replace />;
};

const App = () => (
  <AuthProvider>
    <BrowserRouter>
      <Routes>

        {/* ── Public routes ─────────────────────────────────────────────── */}
        <Route path="/auth"            element={<Auth />} />
        <Route path="/summary/:token"  element={<PublicSummary />} />

        {/* ── Index redirect (role-aware) ───────────────────────────────── */}
        <Route path="/"                element={<IndexRedirect />} />

        {/* ── Dashboard routes (/dashboard/*) ───────────────────────────── */}
        {/* No patient BottomNav/TopBar — DashboardLayout provides own chrome */}

        {/* Outer guard: must be authenticated + have any dashboard role */}
        <Route
          path="/dashboard"
          element={<DashboardRoute requiredRoles={['contributor', 'health_official']} />}
        >
          {/* Default /dashboard → role default */}
          <Route index element={<RoleIndexRedirect />} />

          {/* Per-route role guards — contributor only */}
          <Route path="entry" element={
            <RoleRoute allowedRoles={['contributor']}>
              <EntryPage />
            </RoleRoute>
          }/>
          <Route path="submissions" element={
            <RoleRoute allowedRoles={['contributor']}>
              <SubmissionsPage />
            </RoleRoute>
          }/>

          {/* Per-route role guard — health_official only */}
          <Route path="heatmap" element={
            <RoleRoute allowedRoles={['health_official']}>
              <HeatmapPage />
            </RoleRoute>
          }/>
        </Route>

        {/* ── /contributor-portal — redirect to real route ──────────────── */}
        {/* Kept so any bookmarked Stage 2/3 links still work */}
        <Route path="/contributor-portal" element={<Navigate to="/dashboard/entry" replace />} />

        {/* ── Patient-facing protected routes ───────────────────────────── */}
        <Route path="/onboarding" element={
          <ProtectedRoute showBottomNav={false}><Onboarding /></ProtectedRoute>
        }/>
        <Route path="/home" element={
          <ProtectedRoute><Home /></ProtectedRoute>
        }/>
        <Route path="/triage" element={
          <ProtectedRoute><Triage /></ProtectedRoute>
        }/>
        <Route path="/result/:assessmentId" element={
          <ProtectedRoute><Result /></ProtectedRoute>
        }/>
        <Route path="/history" element={
          <ProtectedRoute><History /></ProtectedRoute>
        }/>
        <Route path="/history/:assessmentId" element={
          <ProtectedRoute><HistoryDetail /></ProtectedRoute>
        }/>
        <Route path="/profile" element={
          <ProtectedRoute showBottomNav={false}><Profile /></ProtectedRoute>
        }/>
        <Route path="/kids-zone" element={
          <ProtectedRoute><KidsZone /></ProtectedRoute>
        }/>
        <Route path="/cure-ai" element={
          <ProtectedRoute><CureAI /></ProtectedRoute>
        }/>
        <Route path="/find-care" element={
          <ProtectedRoute><FindCare /></ProtectedRoute>
        }/>

        {/* ── Catch-all ─────────────────────────────────────────────────── */}
        {/* Dashboard-role users landing on unknown routes go to their default */}
        <Route path="*" element={<CatchAll />} />

      </Routes>
    </BrowserRouter>
  </AuthProvider>
);

// Redirects /dashboard index to the role-specific default sub-route
function RoleIndexRedirect() {
  const { userProfile } = useAuth();
  const role = userProfile?.role || '';
  if (role === 'health_official') return <Navigate to="/dashboard/heatmap" replace />;
  return <Navigate to="/dashboard/entry" replace />;
}

// Catch-all: send dashboard users to their dashboard default, others to /home
function CatchAll() {
  const { user, userProfile, loading } = useAuth();
  if (loading) return null;
  if (!user)   return <Navigate to="/auth" replace />;
  const role = userProfile?.role || '';
  return <Navigate to={roleDefault(role)} replace />;
}

export default App;
