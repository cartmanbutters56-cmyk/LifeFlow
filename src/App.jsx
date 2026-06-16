import React, { useState, useEffect, useCallback } from 'react';
import { useAppStore } from './store/useAppStore';
import { auth, onAuthStateChanged } from './firebase/auth';

import AuthPage from './pages/AuthPage';
import Dashboard from './pages/Dashboard';
import RoutinePlanner from './pages/RoutinePlanner';
import MealPlanner from './pages/MealPlanner';
import WaterTracker from './pages/WaterTracker';
import Streaks from './pages/Streaks';
import StrideTracker from './pages/StrideTracker';
import Profile from './pages/Profile';

const NAV_TABS = [
  {
    id: 'dashboard',
    label: 'Home',
    icon: (active) => (
      <svg
        viewBox="0 0 24 24" fill="none" stroke="currentColor"
        strokeWidth={active ? 2.2 : 1.8}
        strokeLinecap="round" strokeLinejoin="round"
        width={active ? 22 : 20} height={active ? 22 : 20}
      >
        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
        <polyline points="9 22 9 12 15 12 15 22" />
      </svg>
    ),
  },
  {
    id: 'stride',
    label: 'Stride',
    icon: (active) => (
      <svg
        viewBox="0 0 24 24" fill="none" stroke="currentColor"
        strokeWidth={active ? 2.2 : 1.8}
        strokeLinecap="round" strokeLinejoin="round"
        width={active ? 22 : 20} height={active ? 22 : 20}
      >
        <path d="M15.5 2.5c1 0 1.5.7 1.5 1.5s-.5 1.5-1.5 1.5S14 5 14 4s.5-1.5 1.5-1.5z" />
        <path d="M13.5 11l-2-4-2.5 3L10 21" />
        <path d="M6.5 8.5L4 12l3 3" />
        <path d="M10 21l1-7 2.5 1.5L12 21" />
        <circle cx="10" cy="4" r="1" fill="currentColor" stroke="none" />
      </svg>
    ),
  },
  {
    id: 'streaks',
    label: 'Streaks',
    icon: (active) => (
      <svg
        viewBox="0 0 24 24"
        fill={active ? 'currentColor' : 'none'}
        stroke="currentColor"
        strokeWidth={active ? 2.2 : 1.8}
        strokeLinecap="round" strokeLinejoin="round"
        width={active ? 22 : 20} height={active ? 22 : 20}
      >
        <path d="M12 2Q18 10 18 15.5Q18 20 12 20Q6 20 6 15.5Q6 10 12 2" />
        <path d="M12 7.5Q15 12.5 15 16Q15 18.5 12 18.5Q9 18.5 9 16Q9 12.5 12 7.5" />
      </svg>
    ),
  },
  {
    id: 'profile',
    label: 'Profile',
    icon: (active) => (
      <svg
        viewBox="0 0 24 24"
        fill={active ? 'currentColor' : 'none'}
        stroke="currentColor"
        strokeWidth={active ? 2.2 : 1.8}
        strokeLinecap="round" strokeLinejoin="round"
        width={active ? 22 : 20} height={active ? 22 : 20}
      >
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
        <circle cx="12" cy="7" r="4" />
      </svg>
    ),
  },
];

function BottomNav({ activeTab, setActiveTab }) {
  return (
    <nav style={{
      margin: '0 12px 14px',
      borderRadius: 28,
      background: 'var(--nav-bg)',
      backdropFilter: 'blur(32px) saturate(200%)',
      WebkitBackdropFilter: 'blur(32px) saturate(200%)',
      border: '1px solid var(--border-glass)',
      boxShadow: 'var(--nav-shadow)',
      display: 'flex',
      justifyContent: 'space-around',
      alignItems: 'center',
      padding: '4px 6px',
      flexShrink: 0,
    }}>
      {NAV_TABS.map(tab => {
        const active = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              flex: 1,
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
              background: active ? 'var(--accent-soft)' : 'none',
              border: 'none', cursor: 'pointer',
              padding: '6px 0 4px', borderRadius: 16,
              color: active ? 'var(--brand-primary)' : 'var(--text-muted)',
              transition: 'all 0.25s cubic-bezier(0.34,1.56,0.64,1)',
              fontFamily: 'inherit',
            }}
          >
            <div style={{
              transition: 'transform 0.25s cubic-bezier(0.34,1.56,0.64,1)',
              transform: active ? 'scale(1.1)' : 'scale(1)',
              display: 'flex',
            }}>
              {tab.icon(active)}
            </div>
            <span style={{
              fontSize: 9, fontWeight: 700,
              letterSpacing: '0.03em',
              transition: 'color 0.25s ease',
            }}>
              {tab.label}
            </span>
          </button>
        );
      })}
    </nav>
  );
}

const PAGES = {
  dashboard: Dashboard,
  stride: StrideTracker,
  streaks: Streaks,
  profile: Profile,
  water: WaterTracker,
  meals: MealPlanner,
  routines: RoutinePlanner,
};

function AppContent({ user }) {
  const store = useAppStore(user?.uid, user?.displayName);
  const { activeTab, setActiveTab } = store;
  const [mainNavHidden, setMainNavHidden] = useState(false);

  const hideNav = useCallback((hidden) => setMainNavHidden(hidden), []);

  /* Apply theme to <body data-theme="..."> so CSS vars take effect globally */
  useEffect(() => {
    const theme = store.themeMode || 'light';
    document.body.setAttribute('data-theme', theme);
  }, [store.themeMode]);

  const ActivePage = PAGES[activeTab] || Dashboard;

  return (
    <>
      <div className="phone-content">
        <div
          id="app-content-scroll"
          style={{ flex: 1, overflowY: 'auto', position: 'relative' }}
        >
          <ActivePage
            store={store}
            setActiveTab={setActiveTab}
            user={user}
            hideNav={hideNav}
          />
        </div>
        {!mainNavHidden && (
          <BottomNav activeTab={activeTab} setActiveTab={setActiveTab} />
        )}
      </div>
      <div id="modal-portal" />
      <div id="fab-root" />
      <div id="toast-root" />
    </>
  );
}

export default function App() {
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);

  useEffect(() => {
    var cancelled = false;

    // Fallback: stop loading after 4s if auth hangs
    var fallbackTimer = setTimeout(function () {
      if (cancelled) return;
      setAuthLoading(false);
    }, 4000);

    var unsub = onAuthStateChanged(auth, function (firebaseUser) {
      clearTimeout(fallbackTimer);
      if (cancelled) return;
      setUser(firebaseUser);
      setAuthLoading(false);
    });

    return function () {
      cancelled = true;
      clearTimeout(fallbackTimer);
      unsub();
    };
  }, []);

  if (authLoading) {
    return (
      <div style={{
        minHeight: '100dvh', display: 'flex',
        alignItems: 'center', justifyContent: 'center',
        background: 'var(--bg)',
      }}>
        <div style={{ fontSize: 14, color: 'var(--text-muted)', fontWeight: 600 }}>
          Loading...
        </div>
      </div>
    );
  }

  if (!user) {
    return <AuthPage />;
  }

  return <AppContent key={user.uid} user={user} />;
}