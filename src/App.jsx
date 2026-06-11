import React, { useState, useEffect } from 'react';
import { useAppStore } from './store/useAppStore';
import { auth, onAuthStateChanged } from './firebase/auth';

import AuthPage from './pages/AuthPage';
import Dashboard from './pages/Dashboard';
import GymRoutines from './pages/GymRoutines';
import GymHub from './pages/GymHub';
import RoutinePlanner from './pages/RoutinePlanner';
import MealPlanner from './pages/MealPlanner';
import MealHistory from './pages/MealHistory';
import WaterTracker from './pages/WaterTracker';
import Streaks from './pages/Streaks';
import Profile from './pages/Profile';
const NAV_TABS = [
  { id: 'dashboard', label: 'Home', icon: (a) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={a ? 2.2 : 1.8} strokeLinecap="round" strokeLinejoin="round" width={a ? 22 : 20} height={a ? 22 : 20}>
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>
    </svg>
  )},
  { id: 'gym', label: 'Manage', icon: (a) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={a ? 2.2 : 1.8} strokeLinecap="round" strokeLinejoin="round" width={a ? 22 : 20} height={a ? 22 : 20}>
      <rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/>
      <rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>
    </svg>
  )},
  { id: 'streaks', label: 'Streaks', icon: (a) => (
    <svg viewBox="0 0 24 24" fill={a ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={a ? 2.2 : 1.8} strokeLinecap="round" strokeLinejoin="round" width={a ? 22 : 20} height={a ? 22 : 20}>
      <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>
    </svg>
  )},
  { id: 'profile', label: 'Profile', icon: (a) => (
    <svg viewBox="0 0 24 24" fill={a ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={a ? 2.2 : 1.8} strokeLinecap="round" strokeLinejoin="round" width={a ? 22 : 20} height={a ? 22 : 20}>
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
    </svg>
  )},
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
      boxShadow: '0 4px 32px rgba(0,0,0,0.08), 0 2px 8px rgba(0,0,0,0.04)',
      display: 'flex', justifyContent: 'space-around', alignItems: 'center',
      padding: '4px 6px',
      flexShrink: 0,
    }}>
      {NAV_TABS.map(tab => {
        const active = activeTab === tab.id;
        const navColor = active ? 'var(--brand-primary)' : 'var(--text-muted)';
        return (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{
            flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
            background: active ? 'var(--accent-soft)' : 'none',
            border: 'none', cursor: 'pointer', padding: '6px 0 4px', borderRadius: 16,
            color: navColor,
            transition: 'all 0.25s cubic-bezier(0.34,1.56,0.64,1)',
            fontFamily: 'inherit',
          }}>
            <div style={{
              transition: 'transform 0.25s cubic-bezier(0.34,1.56,0.64,1)',
              transform: active ? 'scale(1.1)' : 'scale(1)',
              display: 'flex',
            }}>
              {tab.icon(active)}
            </div>
            <span style={{
              fontSize: 9, fontWeight: 700,
              color: navColor,
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
  gym: GymHub,
  gymroutines: GymRoutines,
  streaks: Streaks,
  profile: Profile,
  water: WaterTracker,
  meals: MealPlanner,
  mealhistory: MealHistory,
  managemeals: Dashboard,
  routines: RoutinePlanner,
  habits: Dashboard,
  tasks: Dashboard,
  goals: Dashboard,
};

function AppContent({ user }) {
  const store = useAppStore(user?.uid, user?.displayName);
  const { activeTab, setActiveTab } = store;

  useEffect(() => { document.body.setAttribute('data-theme', store.themeMode || 'light'); }, [store.themeMode]);

  const ActivePage = PAGES[activeTab] || Dashboard;

  return (
    <>
      <div className="phone-content">
        <div id="app-content-scroll" style={{ flex: 1, overflowY: 'auto', position: 'relative' }}>
          <ActivePage store={store} setActiveTab={setActiveTab} user={user} />
        </div>
        <BottomNav activeTab={activeTab} setActiveTab={setActiveTab} />
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
    const unsub = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      setAuthLoading(false);
    });
    return () => unsub();
  }, []);

  if (authLoading) {
    return (
      <div style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)' }}>
        <div style={{ fontSize: 14, color: 'var(--text-muted)', fontWeight: 600 }}>Loading...</div>
      </div>
    );
  }

  if (!user) {
    return <AuthPage />;
  }

  return <AppContent key={user.uid} user={user} />;
}
