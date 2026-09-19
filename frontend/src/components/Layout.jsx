import React from 'react';
import TopBar from './TopBar';
import BottomNav from './BottomNav';

// ── Stage 2: Layout updated for floating TopBar + BottomNav ──────────────────
// The Stage 1 atmospheric background is already applied globally on <html>
// via index.css @layer base — no additional background needed here.
//
// Padding adjustments for floating chrome:
//   pt-[72px]  — clears floating TopBar (approx 48px bar + 12px top gap + 12px buffer)
//   pb-[88px]  — clears floating BottomNav (approx 64px nav + 12px bottom gap + 12px buffer)
//
// On screens without a BottomNav (showBottomNav=false) the pb- reduces to pb-6.
// On screens without a TopBar (showTopBar=false) the pt- reduces to pt-4.

const Layout = ({ children, showTopBar = true, showBottomNav = true }) => {
  return (
    <div className="min-h-screen flex flex-col">
      {showTopBar && <TopBar />}

      <main
        className={[
          'flex-1 w-full max-w-4xl mx-auto',
          // Horizontal padding: space-md (16px mobile), space-lg (24px desktop)
          'px-0',
          // Top padding: clear floating TopBar when shown
          showTopBar ? 'pt-2' : 'pt-4',
          // Bottom padding: clear floating BottomNav when shown, plus iOS safe area
          showBottomNav
            ? 'pb-[88px] pb-[calc(88px+env(safe-area-inset-bottom))]'
            : 'pb-6',
        ].join(' ')}
      >
        {children}
      </main>

      {showBottomNav && <BottomNav />}
    </div>
  );
};

export default Layout;
