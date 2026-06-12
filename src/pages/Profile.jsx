import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { GlassCard, PillButton, inputStyle, Portal } from '../components/UI';
import { getStats } from '../data/statsService';
import { signOut, auth } from '../firebase/auth';
import { updateProfile } from 'firebase/auth';
import {
  getUserProfile, createUserProfile,
  updateUserHandle, updateUserProfile, getFollowers,
} from '../firebase/friends';

function getInitials(name) {
  if (!name) return 'U';
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2) || 'U';
}

function getJoinDate(completionHistory) {
  const keys = Object.keys(completionHistory || {}).sort();
  if (keys.length === 0) return new Date();
  try {
    const d = new Date(keys[0]);
    return isNaN(d.getTime()) ? new Date() : d;
  } catch { return new Date(); }
}

const THEME_OPTIONS = [
  { value: 'light', label: 'Light', icon: '☀️' },
  { value: 'dark', label: 'Dark', icon: '🌙' },
];

export default function Profile({ store, user, onMessageUser }) {
  const { effectiveTheme, themeMode, setTheme, getDataForStats, setWaterGoal, setCalorieGoal, waterGoal, calorieGoal, calcStreak, completionHistory, waterUnit, setWaterUnit, profileName, setProfileName, friendsRefreshKey } = store;
  const firebasePhoto = user?.photoURL || '';
  const uid = user?.uid || '';

  const [name, setName] = useState(profileName || '');
  const [editName, setEditName] = useState(false);
  const [nameInput, setNameInput] = useState(name);
  const [showWaterGoal, setShowWaterGoal] = useState(false);
  const [showCalGoal, setShowCalGoal] = useState(false);
  const wgRef = useRef(null);
  const cgRef = useRef(null);
  const [mounted, setMounted] = useState(false);

  const [profile, setProfile] = useState(null);
  const [showProfileSettings, setShowProfileSettings] = useState(false);
  const psNameRef = useRef(null);
  const psHandleRef = useRef(null);

  const [streakHistory, setStreakHistory] = useState([]);
  const [followingList, setFollowingList] = useState([]);
  const [followersList, setFollowersList] = useState([]);
  const [showFollowList, setShowFollowList] = useState(false);
  const [followTab, setFollowTab] = useState('following');
  const [viewingProfile, setViewingProfile] = useState(null);
  const [showStreakHistory, setShowStreakHistory] = useState(false);

  const streakKey = uid ? `lf_streaks_v3_${uid}` : 'lf_streaks_v3';

  useEffect(() => {
    if (!uid) return;
    try {
      const raw = localStorage.getItem(streakKey);
      if (raw) {
        const data = JSON.parse(raw);
        setStreakHistory(data.filter(s => s.status === 'completed' || s.status === 'abandoned'));
      }
    } catch {}
  }, [uid]);

  const removeStreak = (id) => {
    const updated = streakHistory.filter(s => s.id !== id);
    setStreakHistory(updated);
    try {
      const raw = localStorage.getItem(streakKey);
      if (raw) {
        const all = JSON.parse(raw);
        const updatedAll = all.filter(s => s.id !== id);
        localStorage.setItem(streakKey, JSON.stringify(updatedAll));
      }
    } catch {}
  };

  useEffect(() => { if (!editName) setName(profileName); }, [profileName]);
  useEffect(() => { const t = setTimeout(() => setMounted(true), 80); return () => clearTimeout(t); }, []);

  const anyOverlayOpen = showStreakHistory || showFollowList || showWaterGoal || showCalGoal || showProfileSettings || viewingProfile;
  useEffect(() => {
    const el = document.getElementById('app-content-scroll');
    if (!el) return;
    if (anyOverlayOpen) {
      el.scrollTop = 0;
      el.style.overflowY = 'hidden';
    } else {
      el.style.overflowY = 'auto';
    }
    return () => { el.style.overflowY = 'auto'; };
  }, [anyOverlayOpen]);

  const loadProfile = useCallback(async () => {
    if (!uid) return;
    try {
      const p = await getUserProfile(uid);
      setProfile(p);
    } catch {}
  }, [uid]);

  useEffect(() => { loadProfile(); }, [loadProfile]);

  const loadFriends = useCallback(async () => {
    const p = await getUserProfile(uid).catch(() => null);
    if (!p) return;
    setProfile(p);
    const followingUids = new Set();
    const followingProfiles = [];
    if (p.friends?.length) {
      for (const fid of p.friends) {
        if (!followingUids.has(fid)) { followingUids.add(fid); const prof = await getUserProfile(fid); if (prof) followingProfiles.push(prof); }
      }
    }
    const outgoing = p.friendRequests?.outgoing || [];
    for (const r of outgoing) {
      const fid = r.uid || r;
      if (!followingUids.has(fid)) { followingUids.add(fid); const prof = await getUserProfile(fid); if (prof) followingProfiles.push(prof); }
    }
    setFollowingList(followingProfiles);
    const followerUids = new Set();
    const followerProfiles = [];
    const mutualFollowers = await getFollowers(uid);
    for (const f of mutualFollowers) {
      if (!followerUids.has(f.id)) { followerUids.add(f.id); followerProfiles.push(f); }
    }
    const incoming = p.friendRequests?.incoming || [];
    for (const r of incoming) {
      const fid = r.uid || r;
      if (!followerUids.has(fid)) { followerUids.add(fid); const prof = await getUserProfile(fid); if (prof) followerProfiles.push(prof); }
    }
    setFollowersList(followerProfiles);
  }, [uid]);

  useEffect(() => { if (uid) loadFriends(); }, [uid, friendsRefreshKey]);

  const handleSaveName = async () => {
    const trimmed = nameInput.trim();
    if (!trimmed) return;
    setName(trimmed);
    setProfileName(trimmed);
    setEditName(false);
    try {
      if (profile) await updateUserProfile(uid, { displayName: trimmed });
      if (auth.currentUser) await updateProfile(auth.currentUser, { displayName: trimmed });
    } catch {}
  };

  const handleSaveProfileSettings = async () => {
    const trimmedName = (psNameRef.current?.value || '').trim();
    if (!trimmedName) { alert('Name cannot be empty'); return; }
    const cleanHandle = (psHandleRef.current?.value || '').toLowerCase().replace(/^@/, '').trim();
    if (!cleanHandle) { alert('Username cannot be empty'); return; }
    try {
      if (profile?.handle) {
        if (cleanHandle !== profile.handle) await updateUserHandle(uid, cleanHandle);
        await updateUserProfile(uid, { displayName: trimmedName });
      } else {
        await createUserProfile(uid, cleanHandle, trimmedName, firebasePhoto);
      }
      setName(trimmedName);
      setProfileName(trimmedName);
      if (auth.currentUser) await updateProfile(auth.currentUser, { displayName: trimmedName });
      await loadProfile();
      setShowProfileSettings(false);
    } catch (e) {
      if (e.message === 'auth/handle-taken') alert('This username is already taken.');
      else alert(e.message || 'Failed to save profile settings.');
    }
  };

  const data = getDataForStats();
  const yearlyStats = useMemo(() => getStats('yearly', data), [data]);
  const yearlyScore = yearlyStats?.overall?.avg ?? 0;

  const allStreaks = {};
  ['routines', 'meals', 'water'].forEach(t => { allStreaks[t] = calcStreak(t); });
  const bestStreak = Math.max(...Object.values(allStreaks), 0);

  const joinDate = useMemo(() => getJoinDate(completionHistory), [completionHistory]);
  const daysSince = Math.max(1, Math.round((Date.now() - joinDate.getTime()) / 86400000));

  const isDark = effectiveTheme === 'dark';

  const fade = (delay = 0) => ({
    opacity: mounted ? 1 : 0,
    transform: mounted ? 'none' : 'translateY(12px)',
    transition: `opacity 0.4s ease ${delay}s, transform 0.4s ease ${delay}s`,
  });

  // ── SHARED MODAL SHELL ──────────────────────────────────────────────
  const ModalShell = ({ onClose, children }) => (
    <Portal>
      <div
        onClick={onClose}
        style={{
          position: 'absolute', inset: 0, zIndex: 1000,
          background: 'var(--overlay)',
          display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
        }}
      >
        <div
          onClick={e => e.stopPropagation()}
          style={{
            width: '100%', maxWidth: 430,
            background: isDark ? '#1C1C1E' : '#FFFFFF',
            borderRadius: '24px 24px 0 0',
            border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'}`,
            borderBottom: 'none',
            padding: '20px 20px 44px',
            animation: 'slideUp 0.3s cubic-bezier(0.34,1.56,0.64,1)',
          }}
        >
          <div style={{ width: 36, height: 4, background: isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.12)', borderRadius: 99, margin: '0 auto 20px' }} />
          {children}
        </div>
      </div>
    </Portal>
  );

  // ── SECTION LABEL ───────────────────────────────────────────────────
  const SectionLabel = ({ children, action }) => (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
      <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
        {children}
      </span>
      {action}
    </div>
  );

  // ── SETTING ROW ─────────────────────────────────────────────────────
  const SettingRow = ({ icon, label, sub, onEdit, borderBottom = true }) => (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12,
      padding: '13px 0',
      borderBottom: borderBottom ? `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}` : 'none',
    }}>
      <div style={{
        width: 36, height: 36, borderRadius: 10, flexShrink: 0,
        background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 17,
      }}>{icon}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', lineHeight: 1.2 }}>{label}</div>
        {sub && <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{sub}</div>}
      </div>
      {onEdit && (
        <button onClick={onEdit} style={{
          fontSize: 12, fontWeight: 600,
          color: isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.4)',
          background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)',
          border: 'none', borderRadius: 8, padding: '6px 12px',
          cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0,
        }}>Edit</button>
      )}
    </div>
  );

  return (
    <div style={{ position: 'relative', overflow: 'hidden', display: 'flex', flexDirection: 'column', paddingBottom: 24, background: 'var(--bg)' }}>

      {/* ── HERO ──────────────────────────────────────────────────── */}
      <div style={{
        position: 'relative', overflow: 'hidden',
        background: isDark
          ? 'linear-gradient(160deg, #2D1F6E 0%, #1A1A2E 100%)'
          : 'linear-gradient(160deg, #6C5CE7 0%, #8B82F0 100%)',
        padding: '52px 20px 28px',
        animation: mounted ? 'heroEnter 0.5s ease both' : 'none',
      }}>
        {/* subtle circles */}
        <div style={{ position: 'absolute', top: -60, right: -40, width: 220, height: 220, borderRadius: '50%', background: 'rgba(255,255,255,0.05)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', bottom: -40, left: -20, width: 160, height: 160, borderRadius: '50%', background: 'rgba(255,255,255,0.04)', pointerEvents: 'none' }} />

        <div style={{ position: 'relative', zIndex: 1, display: 'flex', alignItems: 'center', gap: 18 }}>
          {/* Avatar */}
          <div style={{
            width: 76, height: 76, borderRadius: '50%', flexShrink: 0,
            border: '2.5px solid rgba(255,255,255,0.3)',
            background: firebasePhoto ? 'transparent' : 'rgba(255,255,255,0.15)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 26, fontWeight: 800, color: '#fff',
            fontFamily: "'Outfit', sans-serif", overflow: 'hidden',
          }}>
            {firebasePhoto
              ? <img src={firebasePhoto} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} referrerPolicy="no-referrer" />
              : getInitials(name)
            }
          </div>

          {/* Right side */}
          <div style={{ flex: 1, minWidth: 0 }}>
            {/* Name */}
            <h1 style={{ fontSize: 17, fontWeight: 800, color: '#fff', margin: '0 0 2px', fontFamily: "'Outfit', sans-serif", whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {name || 'Your Name'}
            </h1>
            {profile?.handle && (
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.55)', fontWeight: 500, marginBottom: 10 }}>
                @{profile.handle}
              </div>
            )}

            {/* Followers / Following inline */}
            <div style={{ display: 'flex', gap: 18, marginBottom: 10 }}>
              {[
                { label: 'followers', count: followersList.length, tab: 'followers' },
                { label: 'following', count: followingList.length, tab: 'following' },
              ].map(item => (
                <button
                  key={item.tab}
                  onClick={() => { loadFriends().then(() => { setFollowTab(item.tab); setShowFollowList(true); }); }}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left', padding: 0, display: 'flex', alignItems: 'baseline', gap: 4 }}
                >
                  <span style={{ fontSize: 15, fontWeight: 800, color: '#fff', fontFamily: "'Outfit', sans-serif" }}>{item.count}</span>
                  <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.55)', fontWeight: 500 }}>{item.label}</span>
                </button>
              ))}
            </div>

            {/* Edit Profile button */}
            <button
              onClick={() => setShowProfileSettings(true)}
              style={{
                fontSize: 12, fontWeight: 700,
                color: '#fff', background: 'rgba(255,255,255,0.15)',
                border: '1px solid rgba(255,255,255,0.25)',
                borderRadius: 10, padding: '6px 16px', cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >Edit Profile</button>
          </div>
        </div>
      </div>

      {/* ── STATS ─────────────────────────────────────────────────── */}
      <div style={{ padding: '16px 16px 0', ...fade(0.05) }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
          {[
            { label: 'Days Active', value: daysSince, color: '#6C5CE7', bg: isDark ? 'rgba(108,92,231,0.15)' : 'rgba(108,92,231,0.08)' },
            { label: 'Avg Score', value: `${Math.round(yearlyScore)}%`, color: '#00C896', bg: isDark ? 'rgba(0,200,150,0.12)' : 'rgba(0,200,150,0.08)' },
            { label: 'Best Streak', value: `${bestStreak}d`, color: '#F5A623', bg: isDark ? 'rgba(245,166,35,0.15)' : 'rgba(245,166,35,0.08)' },
          ].map(s => (
            <div key={s.label} style={{
              background: s.bg, borderRadius: 16, padding: '14px 8px',
              textAlign: 'center',
              border: `1px solid ${isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)'}`,
            }}>
              <div style={{ fontSize: 24, fontWeight: 900, color: s.color, fontFamily: "'Outfit', sans-serif", lineHeight: 1 }}>
                {s.value}
              </div>
              <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', marginTop: 4, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                {s.label}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── STREAK HISTORY ROW (tappable) ─────────────────────────── */}
      <div style={{ padding: '20px 16px 0', ...fade(0.10) }}>
        <SectionLabel>Streak History</SectionLabel>
        <button
          onClick={() => setShowStreakHistory(true)}
          style={{
            width: '100%', display: 'flex', alignItems: 'center', gap: 14,
            padding: '14px 16px', borderRadius: 18, cursor: 'pointer',
            fontFamily: 'inherit', textAlign: 'left',
            background: isDark
              ? 'linear-gradient(135deg, rgba(245,166,35,0.10) 0%, rgba(108,92,231,0.10) 100%)'
              : 'linear-gradient(135deg, rgba(245,166,35,0.07) 0%, rgba(108,92,231,0.07) 100%)',
            border: `1px solid ${isDark ? 'rgba(245,166,35,0.18)' : 'rgba(245,166,35,0.2)'}`,
          }}
        >
          <div style={{
            width: 44, height: 44, borderRadius: 14, flexShrink: 0,
            background: isDark ? 'rgba(245,166,35,0.18)' : 'rgba(245,166,35,0.12)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22,
          }}>🔥</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>Streak History</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
              {streakHistory.length === 0 ? 'No history yet' : `${streakHistory.length} streak${streakHistory.length !== 1 ? 's' : ''} recorded`}
            </div>
          </div>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 18l6-6-6-6" />
          </svg>
        </button>
      </div>

      {/* ── STREAK HISTORY FULLSCREEN ─────────────────────────────── */}
      {showStreakHistory && (
        <div style={{
          position: 'absolute', inset: 0, zIndex: 300,
          background: 'var(--bg)', display: 'flex', flexDirection: 'column', minHeight: '100%',
        }}>
          {/* header */}
          <div style={{
            background: isDark
              ? 'linear-gradient(160deg, #2D1F6E 0%, #1A1A2E 100%)'
              : 'linear-gradient(160deg, #6C5CE7 0%, #8B82F0 100%)',
            padding: '48px 16px 24px', position: 'relative', overflow: 'hidden',
          }}>
            <div style={{ position: 'absolute', top: -40, right: -30, width: 160, height: 160, borderRadius: '50%', background: 'rgba(255,255,255,0.05)', pointerEvents: 'none' }} />
            <button
              onClick={() => setShowStreakHistory(false)}
              style={{
                position: 'absolute', top: 14, left: 14,
                width: 36, height: 36, borderRadius: 12,
                background: 'rgba(255,255,255,0.15)', border: 'none',
                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M19 12H5" /><path d="M12 19l-7-7 7-7" />
              </svg>
            </button>
            <div style={{ textAlign: 'center', position: 'relative', zIndex: 1 }}>
              <div style={{ fontSize: 36, marginBottom: 8 }}>🔥</div>
              <h2 style={{ fontSize: 20, fontWeight: 800, color: '#fff', margin: 0, fontFamily: "'Outfit', sans-serif" }}>Streak History</h2>
              <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.55)', marginTop: 4 }}>
                {streakHistory.length === 0 ? 'No streaks yet' : `${streakHistory.length} streak${streakHistory.length !== 1 ? 's' : ''} recorded`}
              </div>
            </div>

            {/* summary pills */}
            {streakHistory.length > 0 && (
              <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 16 }}>
                <div style={{ background: 'rgba(0,200,150,0.25)', borderRadius: 20, padding: '5px 14px', display: 'flex', alignItems: 'center', gap: 5 }}>
                  <span style={{ fontSize: 12 }}>✓</span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: '#00C896' }}>
                    {streakHistory.filter(s => s.status === 'completed').length} completed
                  </span>
                </div>
                <div style={{ background: 'rgba(255,59,48,0.25)', borderRadius: 20, padding: '5px 14px', display: 'flex', alignItems: 'center', gap: 5 }}>
                  <span style={{ fontSize: 12 }}>✕</span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: '#FF6B6B' }}>
                    {streakHistory.filter(s => s.status === 'abandoned').length} dropped
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* list */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '16px 16px' }}>
            {streakHistory.length === 0 ? (
              <div style={{
                textAlign: 'center', padding: '60px 32px',
                background: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)',
                borderRadius: 20, marginTop: 8,
                border: `1px dashed ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}`,
              }}>
                <div style={{ fontSize: 40, marginBottom: 12 }}>🔥</div>
                <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', marginBottom: 6 }}>No streak history yet</div>
                <div style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.5 }}>Complete or abandon a streak and it will appear here</div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {streakHistory.slice().reverse().map(s => {
                  const best = s.bestStreak || 0;
                  const isCompleted = s.status === 'completed';
                  const endDate = s.completedDate || s.abandonedDate;
                  const endLabel = endDate
                    ? new Date(endDate + 'T12:00:00').toLocaleDateString('en', { month: 'short', day: 'numeric', year: 'numeric' })
                    : '';

                  return (
                    <div key={s.id} style={{
                      borderRadius: 20, overflow: 'hidden',
                      border: `1px solid ${isCompleted
                        ? (isDark ? 'rgba(0,200,150,0.2)' : 'rgba(0,200,150,0.18)')
                        : (isDark ? 'rgba(255,59,48,0.2)' : 'rgba(255,59,48,0.15)')}`,
                      background: isCompleted
                        ? (isDark ? 'linear-gradient(135deg, rgba(0,200,150,0.08) 0%, rgba(0,200,150,0.02) 100%)' : 'linear-gradient(135deg, rgba(0,200,150,0.06) 0%, rgba(0,200,150,0.01) 100%)')
                        : (isDark ? 'linear-gradient(135deg, rgba(255,59,48,0.07) 0%, rgba(255,59,48,0.02) 100%)' : 'linear-gradient(135deg, rgba(255,59,48,0.05) 0%, rgba(255,59,48,0.01) 100%)'),
                    }}>
                      {/* top row */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 14px 10px' }}>
                        <div style={{
                          width: 48, height: 48, borderRadius: 16, flexShrink: 0,
                          background: isCompleted
                            ? (isDark ? 'rgba(0,200,150,0.18)' : 'rgba(0,200,150,0.12)')
                            : (isDark ? 'rgba(255,59,48,0.18)' : 'rgba(255,59,48,0.1)'),
                          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22,
                        }}>
                          {s.icon || '🔥'}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', marginBottom: 4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {s.title}
                          </div>
                          <span style={{
                            fontSize: 10, fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase',
                            color: isCompleted ? '#00C896' : '#FF3B30',
                            background: isCompleted
                              ? (isDark ? 'rgba(0,200,150,0.18)' : 'rgba(0,200,150,0.12)')
                              : (isDark ? 'rgba(255,59,48,0.18)' : 'rgba(255,59,48,0.1)'),
                            borderRadius: 6, padding: '3px 8px',
                          }}>
                            {isCompleted ? '✓ Completed' : '✕ Dropped'}
                          </span>
                        </div>
                        <button
                          onClick={() => removeStreak(s.id)}
                          style={{
                            width: 32, height: 32, borderRadius: 10, border: 'none',
                            background: isDark ? 'rgba(255,59,48,0.12)' : 'rgba(255,59,48,0.08)',
                            color: '#FF3B30', fontSize: 13, cursor: 'pointer',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            flexShrink: 0, fontWeight: 700, fontFamily: 'inherit',
                          }}
                        >✕</button>
                      </div>

                      {/* bottom stats row */}
                      <div style={{
                        display: 'flex',
                        borderTop: `1px solid ${isCompleted ? 'rgba(0,200,150,0.1)' : 'rgba(255,59,48,0.1)'}`,
                        margin: '0 14px',
                      }}>
                        {[
                          { label: 'Best', value: `${best} days`, icon: '🔥' },
                          { label: 'Ended', value: endLabel || '—', icon: '📅' },
                          { label: 'Type', value: s.type || 'Solo', icon: '🏷️' },
                        ].map((stat, i) => (
                          <div key={stat.label} style={{
                            flex: 1, padding: '10px 4px', textAlign: 'center',
                            borderRight: i < 2 ? `1px solid ${isCompleted ? 'rgba(0,200,150,0.1)' : 'rgba(255,59,48,0.1)'}` : 'none',
                          }}>
                            <div style={{ fontSize: 12 }}>{stat.icon}</div>
                            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginTop: 2 }}>{stat.value}</div>
                            <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase' }}>{stat.label}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
      
      {/* ── SETTINGS ──────────────────────────────────────────────── */}
      <div style={{ padding: '20px 16px 0', ...fade(0.14) }}>
        <SectionLabel>Settings</SectionLabel>
        <div style={{
          borderRadius: 16, overflow: 'hidden',
          border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
          background: isDark ? 'rgba(255,255,255,0.03)' : '#fff',
          padding: '0 14px',
        }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 12, padding: '13px 0',
            borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
          }}>
            <div style={{
              width: 36, height: 36, borderRadius: 10, flexShrink: 0,
              background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 17,
            }}>🎨</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>Appearance</div>
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              {THEME_OPTIONS.map(opt => (
                <button key={opt.value} onClick={() => setTheme(opt.value)} style={{
                  padding: '7px 12px', borderRadius: 10, cursor: 'pointer', fontFamily: 'inherit',
                  border: `1.5px solid ${themeMode === opt.value ? '#6C5CE7' : (isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)')}`,
                  background: themeMode === opt.value ? (isDark ? 'rgba(108,92,231,0.2)' : 'rgba(108,92,231,0.08)') : 'transparent',
                  color: themeMode === opt.value ? '#6C5CE7' : 'var(--text-muted)',
                  fontWeight: 700, fontSize: 13, transition: 'all 0.2s',
                }}>{opt.icon} {opt.label}</button>
              ))}
            </div>
          </div>

          <SettingRow
            icon="💧"
            label="Water goal"
            sub={`${waterUnit === 'cups' ? Math.round(waterGoal / 8) : waterUnit === 'ml' ? Math.round(waterGoal * 29.5735) : waterGoal} ${waterUnit === 'cups' ? 'cups' : waterUnit === 'ml' ? 'ml' : 'oz'} · ${waterUnit.toUpperCase()} display`}
            onEdit={() => setShowWaterGoal(true)}
            borderBottom
          />
          <SettingRow
            icon="🍽️"
            label="Calorie goal"
            sub={`${calorieGoal} kcal / day`}
            onEdit={() => setShowCalGoal(true)}
            borderBottom
          />
          
        </div>
      </div>

      {/* ── SIGN OUT ──────────────────────────────────────────────── */}
      <div style={{ padding: '16px 16px 0', ...fade(0.18) }}>
        <button onClick={signOut} style={{
          width: '100%', padding: '14px 0', borderRadius: 14,
          border: '1px solid rgba(255,59,48,0.3)',
          background: isDark ? 'rgba(255,59,48,0.08)' : 'rgba(255,59,48,0.04)',
          color: '#FF3B30', fontSize: 14, fontWeight: 700,
          cursor: 'pointer', fontFamily: 'inherit', letterSpacing: '0.02em',
          transition: 'opacity 0.15s',
        }}>
          Sign Out
        </button>
      </div>

      {/* Footer */}
      <div style={{ textAlign: 'center', padding: '16px 0 0', ...fade(0.20) }}>
        <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 500 }}>LifeFlow v1.0</span>
      </div>

      {/* ── FOLLOWING / FOLLOWERS FULLSCREEN ──────────────────────── */}
      {showFollowList && (
        <div style={{
          position: 'absolute', inset: 0, zIndex: 300,
          background: 'var(--bg)', display: 'flex', flexDirection: 'column', minHeight: '100%',
        }}>
          {/* header */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px',
            borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
          }}>
            <button onClick={() => setShowFollowList(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, display: 'flex', alignItems: 'center' }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--text)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M19 12H5" /><path d="M12 19l-7-7 7-7" />
              </svg>
            </button>
            <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)' }}>
              {followTab === 'following' ? 'Following' : 'Followers'}
            </span>
          </div>

          {/* tab bar */}
          <div style={{
            display: 'flex',
            borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
          }}>
            {[
              { key: 'following', label: 'Following', count: followingList.length },
              { key: 'followers', label: 'Followers', count: followersList.length },
            ].map(tab => (
              <button key={tab.key} onClick={() => setFollowTab(tab.key)} style={{
                flex: 1, padding: '12px 0', background: 'none', border: 'none', cursor: 'pointer',
                fontSize: 13, fontWeight: 700, letterSpacing: '0.03em', fontFamily: 'inherit',
                color: followTab === tab.key ? 'var(--text)' : 'var(--text-muted)',
                borderBottom: `2px solid ${followTab === tab.key ? '#6C5CE7' : 'transparent'}`,
                transition: 'all 0.15s',
              }}>
                {tab.label} {tab.count}
              </button>
            ))}
          </div>

          {/* list */}
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {(followTab === 'following' ? followingList : followersList).length === 0 ? (
              <div style={{ padding: '60px 32px', textAlign: 'center' }}>
                <div style={{ fontSize: 36, marginBottom: 12 }}>
                  {followTab === 'following' ? '🔍' : '👥'}
                </div>
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', marginBottom: 4 }}>
                  {followTab === 'following' ? 'Not following anyone yet' : 'No followers yet'}
                </div>
                <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                  {followTab === 'following' ? 'Find friends to follow' : 'Share your profile to get followers'}
                </div>
              </div>
            ) : (
              (followTab === 'following' ? followingList : followersList).map(f => (
                <div
                  key={f.id}
                  onClick={() => setViewingProfile(f)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px',
                    borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'}`,
                    cursor: 'pointer',
                  }}
                >
                  <div style={{
                    width: 44, height: 44, borderRadius: '50%', flexShrink: 0,
                    background: isDark ? 'rgba(108,92,231,0.2)' : 'rgba(108,92,231,0.1)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 15, fontWeight: 700, color: '#6C5CE7', overflow: 'hidden',
                  }}>
                    {f.photoURL
                      ? <img src={f.photoURL} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} referrerPolicy="no-referrer" />
                      : getInitials(f.displayName)
                    }
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>{f.displayName || 'User'}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>@{f.handle}</div>
                  </div>
                  {onMessageUser && (
                    <button
                      onClick={e => { e.stopPropagation(); onMessageUser(f); }}
                      style={{
                        fontSize: 12, fontWeight: 700, color: '#6C5CE7',
                        background: isDark ? 'rgba(108,92,231,0.15)' : 'rgba(108,92,231,0.08)',
                        border: '1px solid rgba(108,92,231,0.2)',
                        borderRadius: 10, padding: '6px 14px', cursor: 'pointer',
                        fontFamily: 'inherit', flexShrink: 0,
                      }}
                    >Message</button>
                  )}
                </div>
              ))
            )}
          </div>
          </div>
      )}

      {/* ── PROFILE VIEW MODAL ────────────────────────────────────── */}
      {viewingProfile && (
        <Portal>
          <div
            onClick={() => setViewingProfile(null)}
            style={{ position: 'absolute', inset: 0, zIndex: 400, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}
          >
            <div
              onClick={e => e.stopPropagation()}
              style={{
                width: '100%', maxWidth: 430,
                background: isDark ? '#1C1C1E' : '#fff',
                borderRadius: '24px 24px 0 0',
                border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'}`,
                borderBottom: 'none', padding: '20px 20px 48px',
              }}
            >
              <div style={{ width: 36, height: 4, background: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.1)', borderRadius: 99, margin: '0 auto 20px' }} />
              <div style={{ textAlign: 'center', marginBottom: 20 }}>
                <div style={{
                  width: 64, height: 64, borderRadius: '50%', margin: '0 auto 12px',
                  background: isDark ? 'rgba(108,92,231,0.2)' : 'rgba(108,92,231,0.1)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 24, fontWeight: 700, color: '#6C5CE7', overflow: 'hidden',
                }}>
                  {viewingProfile.photoURL
                    ? <img src={viewingProfile.photoURL} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} referrerPolicy="no-referrer" />
                    : getInitials(viewingProfile.displayName)
                  }
                </div>
                <p style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)', margin: 0 }}>{viewingProfile.displayName || 'User'}</p>
                <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 2 }}>@{viewingProfile.handle}</p>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                {[
                  { label: 'Following', value: (viewingProfile.friends || []).length },
                  { label: 'Followers', value: 0 },
                  { label: 'Joined', value: viewingProfile.createdAt?.toDate ? new Date(viewingProfile.createdAt.toDate()).toLocaleDateString('en', { month: 'short', day: 'numeric' }) : '—' },
                ].map(s => (
                  <div key={s.label} style={{
                    textAlign: 'center', padding: '12px 4px',
                    background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)',
                    borderRadius: 12,
                  }}>
                    <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)' }}>{s.value}</div>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 600, marginTop: 2, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{s.label}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Portal>
      )}

      {/* ── PROFILE SETTINGS MODAL ────────────────────────────────── */}
      {showProfileSettings && (
        <ModalShell onClose={() => setShowProfileSettings(false)}>
          <h3 style={{ fontSize: 18, fontWeight: 800, color: 'var(--text)', margin: '0 0 4px', fontFamily: "'Outfit', sans-serif" }}>Edit Profile</h3>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: '0 0 20px' }}>Your Google account stays unchanged.</p>

          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 6, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Display Name</div>
          <input ref={psNameRef} defaultValue={name || ''} style={{ ...inputStyle, marginBottom: 16 }} placeholder="Your name" />

          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 6, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Username</div>
          <input ref={psHandleRef} defaultValue={profile?.handle || ''} style={{ ...inputStyle, marginBottom: 20 }} placeholder="@username" />

          <button
            onClick={handleSaveProfileSettings}
            style={{
              width: '100%', padding: '14px 0', borderRadius: 14, border: 'none',
              background: '#6C5CE7', color: '#fff', fontSize: 15, fontWeight: 700,
              cursor: 'pointer', fontFamily: 'inherit',
            }}
          >Save Profile</button>
        </ModalShell>
      )}

      {/* ── WATER SETTINGS MODAL ──────────────────────────────────── */}
      {showWaterGoal && (
        <ModalShell onClose={() => setShowWaterGoal(false)}>
          <h3 style={{ fontSize: 18, fontWeight: 800, color: 'var(--text)', margin: '0 0 16px', fontFamily: "'Outfit', sans-serif" }}>Water Settings</h3>

          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 8, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Display Unit</div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 18 }}>
            {['oz', 'cups', 'ml'].map(u => (
              <button key={u} onClick={() => setWaterUnit(u)} style={{
                flex: 1, padding: '11px', borderRadius: 12, cursor: 'pointer',
                border: `1.5px solid ${waterUnit === u ? '#6C5CE7' : (isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)')}`,
                background: waterUnit === u ? (isDark ? 'rgba(108,92,231,0.2)' : 'rgba(108,92,231,0.08)') : 'transparent',
                color: waterUnit === u ? '#6C5CE7' : 'var(--text)', fontWeight: 700, fontSize: 13,
                fontFamily: 'inherit', transition: 'all 0.2s',
              }}>{u === 'cups' ? '🥤 Cups' : u === 'ml' ? '🧪 ml' : '💧 Oz'}</button>
            ))}
          </div>

          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 8, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Daily Goal ({waterUnit === 'cups' ? 'glasses' : waterUnit === 'ml' ? 'ml' : 'oz'})</div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 16 }}>
            <input ref={wgRef}
              style={{ ...inputStyle, flex: 1, fontSize: 18, fontWeight: 700, padding: '14px 16px', borderRadius: 14 }}
              inputMode="numeric" pattern="[0-9]*"
              placeholder={waterUnit === 'ml' ? 'e.g. 2000' : waterUnit === 'cups' ? 'e.g. 8' : 'e.g. 64'}
              defaultValue={waterUnit === 'ml' ? Math.round(waterGoal * 29.5735) : waterUnit === 'cups' ? Math.round(waterGoal / 8) : waterGoal}
            />
            <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-muted)', flexShrink: 0 }}>
              {waterUnit === 'cups' ? 'glasses' : waterUnit === 'ml' ? 'ml' : 'oz'}
            </span>
          </div>
          <button
            onClick={() => {
              if (!wgRef.current) return;
              const val = parseFloat(wgRef.current.value);
              if (val > 0) {
                const oz = waterUnit === 'cups' ? val * 8 : waterUnit === 'ml' ? Math.round(val / 29.5735) : val;
                setWaterGoal(oz);
              }
              setShowWaterGoal(false);
            }}
            style={{ width: '100%', padding: '14px 0', borderRadius: 14, border: 'none', background: '#6C5CE7', color: '#fff', fontSize: 15, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}
          >Save Settings</button>
        </ModalShell>
      )}

      {/* ── CALORIE GOAL MODAL ────────────────────────────────────── */}
      {showCalGoal && (
        <ModalShell onClose={() => setShowCalGoal(false)}>
          <h3 style={{ fontSize: 18, fontWeight: 800, color: 'var(--text)', margin: '0 0 12px', fontFamily: "'Outfit', sans-serif" }}>Calorie Goal</h3>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: '0 0 18px', lineHeight: 1.4 }}>
            Enter your daily calorie target
          </p>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 16 }}>
            <input ref={cgRef}
              style={{ ...inputStyle, flex: 1, fontSize: 18, fontWeight: 700, padding: '14px 16px', borderRadius: 14 }}
              inputMode="numeric" pattern="[0-9]*"
              placeholder="e.g. 2000"
              defaultValue={calorieGoal}
            />
            <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-muted)', flexShrink: 0 }}>
              kcal
            </span>
          </div>
          <button
            onClick={() => { if (!cgRef.current) return; const g = parseFloat(cgRef.current.value); if (g > 0) setCalorieGoal(g); setShowCalGoal(false); }}
            style={{ width: '100%', padding: '14px 0', borderRadius: 14, border: 'none', background: '#00C896', color: '#fff', fontSize: 15, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}
          >Save Goal</button>
        </ModalShell>
      )}

    </div>
  );
}