import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { searchUsers, getUserProfile, sendFriendRequest, acceptFriendRequest, declineFriendRequest, cancelFriendRequest, removeFriend } from '../firebase/friends';
import { ensureChatExists, sendStreakInvite } from '../firebase/chat';
import Messages from '../components/Messages';

function getInitials(name) {
  if (!name) return 'U';
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2) || 'U';
}

// ─── Constants ────────────────────────────────────────────────────────────────

const STREAKS_KEY = 'lf_streaks_v3';
const MILESTONES = [7, 14, 30, 60, 100];
const DURATION_OPTS = [3, 7, 14, 21, 30, 60, 90];

const CATEGORIES = [
  { id: 'water',       label: 'Water',       icon: '💧', color: '#17A8D1' },
  { id: 'nutrition',   label: 'Nutrition',   icon: '🍎', color: '#3DB87A' },
  { id: 'fitness',     label: 'Fitness',     icon: '🏃', color: '#F5A623' },
  { id: 'mindfulness', label: 'Mindfulness', icon: '🧘', color: '#9B59B6' },
  { id: 'lifestyle',   label: 'Lifestyle',   icon: '⭐', color: '#E74C6F' },
];

// ─── Storage ──────────────────────────────────────────────────────────────────

function load(uid) {
  const key = uid ? `${STREAKS_KEY}_${uid}` : STREAKS_KEY;
  try { const r = localStorage.getItem(key); return r ? JSON.parse(r) : []; }
  catch { return []; }
}
function save(uid, data) {
  const key = uid ? `${STREAKS_KEY}_${uid}` : STREAKS_KEY;
  try { localStorage.setItem(key, JSON.stringify(data)); } catch {}
}
function genId() { return 's' + Date.now() + '_' + Math.random().toString(36).slice(2, 6); }

// ─── Date helpers ─────────────────────────────────────────────────────────────

function fmtKey(d) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
function getDayKeys(startDate, duration) {
  if (!startDate) return [];
  const s = new Date(startDate + 'T12:00:00');
  return Array.from({ length: duration }, (_, i) => {
    const d = new Date(s); d.setDate(d.getDate() + i); return fmtKey(d);
  });
}
function calcStreak(checkIns, todayKey) {
  let streak = 0;
  const d = new Date(todayKey + 'T12:00:00');
  for (let i = 0; i < 1000; i++) {
    if (checkIns[fmtKey(d)]) { streak++; d.setDate(d.getDate() - 1); }
    else break;
  }
  return streak;
}
function getWeekDays(todayKey) {
  const today = new Date(todayKey + 'T12:00:00');
  const s = new Date(today); s.setDate(s.getDate() - 6);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(s); d.setDate(d.getDate() + i);
    const key = fmtKey(d);
    return { key, isToday: key === todayKey, label: d.toLocaleDateString('en', { weekday: 'narrow' }) };
  });
}

// ─── Theme ────────────────────────────────────────────────────────────────────

const theme = {
  bg: 'var(--bg)',
  surface: 'var(--surface)',
  surfaceAlt: 'var(--surface-alt)',
  border: 'var(--border)',
  text: 'var(--text)',
  textSub: 'var(--text-sub)',
  textMuted: 'var(--text-muted)',
  accent: '#1CE3A0',
  accentText: '#0A5C3E',
};

const cssVars = `
  :root {
    --bg: #ffffff;
    --surface: #ffffff;
    --surface-alt: #F9F9F9;
    --border: #EFEFEF;
    --text: #1A1A1A;
    --text-sub: #6B6B6B;
    --text-muted: #ADADAD;
    --input-placeholder: #ADADAD;
  }
  [data-theme="dark"] {
    --bg: #111111;
    --surface: #1C1C1C;
    --surface-alt: #252525;
    --border: #2E2E2E;
    --text: #F0F0F0;
    --text-sub: #A0A0A0;
    --text-muted: #606060;
    --input-placeholder: #606060;
    }
  }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { background: var(--bg); }
  input, button, select, textarea { font-family: inherit; }
  input:focus { outline: none; }
`;

// ─── Styles ───────────────────────────────────────────────────────────────────

const S = {
  screen: {
    fontFamily: "'DM Sans', -apple-system, BlinkMacSystemFont, sans-serif",
    background: 'var(--bg)',
    minHeight: '100%',
    color: 'var(--text)',
  },
  header: {
    padding: '20px 20px 0',
    borderBottom: '1px solid var(--border)',
    background: 'var(--bg)',
  },
  tabRow: { display: 'flex', gap: 0, marginTop: 16 },
  tab: (active) => ({
    flex: 1, padding: '10px 0', background: 'none', border: 'none',
    cursor: 'pointer', fontSize: 13, fontWeight: 700,
    letterSpacing: '0.04em', textTransform: 'uppercase',
    color: active ? 'var(--text)' : 'var(--text-muted)',
    borderBottom: active ? '2.5px solid var(--text)' : '2.5px solid transparent',
    transition: 'all 0.15s',
    fontFamily: 'inherit',
  }),
  sectionLabel: {
    fontSize: 11, fontWeight: 700, color: 'var(--text-muted)',
    letterSpacing: '0.08em', textTransform: 'uppercase',
    margin: '24px 20px 10px',
  },
  streakRow: {
    display: 'flex', alignItems: 'center', gap: 12,
    padding: '14px 20px',
    borderBottom: '1px solid var(--border)',
    cursor: 'pointer',
    background: 'var(--bg)',
  },
  rowTitle: { fontSize: 15, fontWeight: 600, color: 'var(--text)', margin: 0 },
  rowSub: { fontSize: 12, color: 'var(--text-muted)', margin: '1px 0 0', fontWeight: 400 },
  streakBadge: (color) => ({
    marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 4,
    background: color + '18', borderRadius: 20,
    padding: '4px 10px', flexShrink: 0,
  }),
  badgeCount: (color) => ({ fontSize: 13, fontWeight: 700, color }),
  pendingCard: {
    margin: '0 20px 12px',
    border: '1px solid var(--border)',
    borderRadius: 16,
    padding: '14px 16px',
    background: 'var(--surface-alt)',
  },
  pendingName: { fontSize: 14, fontWeight: 600, color: 'var(--text)' },
  pendingMsg: { fontSize: 12, color: 'var(--text-muted)', marginTop: 2 },
  pendingBtns: { display: 'flex', gap: 8, marginTop: 12 },
  btn: (primary) => ({
    flex: 1, padding: '9px 0', borderRadius: 8,
    border: primary ? 'none' : '1.5px solid var(--border)',
    background: primary ? '#1CE3A0' : 'var(--surface)',
    color: primary ? '#0A5C3E' : 'var(--text-sub)',
    fontSize: 12, fontWeight: 700, cursor: 'pointer',
    fontFamily: 'inherit', letterSpacing: '0.03em', textTransform: 'uppercase',
  }),
  empty: {
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    padding: '60px 32px', textAlign: 'center',
  },
  emptyIcon: { fontSize: 48, marginBottom: 16 },
  emptyTitle: { fontSize: 18, fontWeight: 700, color: 'var(--text)', margin: '0 0 6px' },
  emptyDesc: { fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.5, margin: '0 0 24px' },
  detailCard: {
    margin: '0 20px 16px',
    border: '1px solid var(--border)',
    borderRadius: 20,
    overflow: 'hidden',
    background: 'var(--surface)',
  },
  detailTop: (color) => ({
    padding: '18px 18px 14px',
    borderBottom: '1px solid var(--border)',
    background: color + '0D',
  }),
  detailIconRow: { display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 },
  detailTitle: { fontSize: 16, fontWeight: 700, color: 'var(--text)', margin: 0 },
  detailDesc: { fontSize: 12, color: 'var(--text-muted)', margin: '2px 0 0' },
  streakNum: (color) => ({
    fontSize: 40, fontWeight: 800, color, lineHeight: 1, fontVariantNumeric: 'tabular-nums',
  }),
  streakLabel: { fontSize: 12, color: 'var(--text-muted)', fontWeight: 500, marginLeft: 2 },
  detailBottom: { padding: '14px 18px' },
  weekRow: { display: 'flex', gap: 4, marginBottom: 14 },
  dot: (filled, isToday, color) => ({
    flex: 1, height: 6, borderRadius: 99,
    background: filled ? color : isToday ? color + '40' : 'var(--border)',
  }),
  checkBtn: (done, color) => ({
    width: '100%', padding: '12px 0', borderRadius: 12, border: 'none',
    background: done ? 'var(--surface-alt)' : color,
    color: done ? 'var(--text-muted)' : '#fff',
    fontSize: 14, fontWeight: 700, cursor: 'pointer',
    fontFamily: 'inherit', transition: 'background 0.15s',
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
  }),
  abandonBtn: {
    background: 'none', border: 'none', cursor: 'pointer',
    fontSize: 11, color: 'var(--text-muted)', fontFamily: 'inherit',
    fontWeight: 600, marginTop: 8, letterSpacing: '0.03em',
    textTransform: 'uppercase', width: '100%', padding: '4px 0',
  },
  milestoneRow: { display: 'flex', gap: 4, marginBottom: 12 },
  milestone: (unlocked, color) => ({
    flex: 1, padding: '5px 2px', borderRadius: 8, textAlign: 'center',
    background: unlocked ? color + '18' : 'var(--surface-alt)',
    border: unlocked ? `1px solid ${color}35` : '1px solid var(--border)',
  }),
  mNum: (unlocked, color) => ({
    fontSize: 11, fontWeight: 700, color: unlocked ? color : 'var(--text-muted)', display: 'block',
  }),
  sheet: {
    position: 'absolute', inset: 0, zIndex: 200,
    background: 'var(--overlay)',
    backdropFilter: 'var(--overlay-blur)',
    display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
  },
  sheetInner: {
    width: '100%', maxWidth: 393, background: 'var(--surface)',
    borderRadius: '24px 24px 0 0',
    padding: '0 0 48px', maxHeight: '90vh', overflowY: 'auto',
  },
  sheetHandle: {
    width: 40, height: 4, background: 'var(--border)', borderRadius: 99,
    margin: '14px auto 0',
  },
  sheetTitle: {
    fontSize: 18, fontWeight: 700, color: 'var(--text)',
    padding: '18px 20px 4px', margin: 0,
  },
  sheetSub: {
    fontSize: 13, color: 'var(--text-muted)',
    padding: '0 20px 16px', borderBottom: '1px solid var(--border)',
  },
  friendRow: (selected) => ({
    display: 'flex', alignItems: 'center', gap: 12,
    padding: '13px 20px', cursor: 'pointer',
    background: selected ? '#1CE3A010' : 'var(--surface)',
    borderBottom: '1px solid var(--border)',
    transition: 'background 0.1s',
  }),
  celebOverlay: {
    position: 'absolute', inset: 0, zIndex: 300,
    background: 'var(--bg)',
    display: 'flex', flexDirection: 'column',
    alignItems: 'center', justifyContent: 'center',
    padding: 32,
  },
  celebNum: { fontSize: 80, fontWeight: 800, color: '#1CE3A0', lineHeight: 1, marginBottom: 8 },
  celebTitle: { fontSize: 22, fontWeight: 700, color: 'var(--text)', textAlign: 'center', marginBottom: 6 },
  celebSub: { fontSize: 14, color: 'var(--text-muted)', textAlign: 'center', marginBottom: 40 },
  continueBtn: {
    width: '100%', maxWidth: 320, padding: '14px 0', borderRadius: 14, border: 'none',
    background: '#1CE3A0', color: '#0A5C3E',
    fontSize: 15, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
  },
  inputStyle: {
    width: '100%', padding: '10px 14px', borderRadius: 10,
    border: '1px solid var(--border)', background: '#F0F0F0',
    fontSize: 14, color: '#1A1A1A', fontFamily: 'inherit',
    boxSizing: 'border-box', outline: 'none',
  },
  label: {
    fontSize: 11, fontWeight: 700, color: 'var(--text-muted)',
    letterSpacing: '0.06em', textTransform: 'uppercase',
    display: 'block', marginBottom: 6,
  },
  field: { padding: '0 20px', marginBottom: 16 },
  chipRow: { display: 'flex', gap: 6, flexWrap: 'wrap' },
  chip: (active, color) => ({
    padding: '7px 14px', borderRadius: 99, cursor: 'pointer', fontFamily: 'inherit',
    border: `1.5px solid ${active ? color : 'var(--border)'}`,
    background: active ? color + '15' : 'var(--surface)',
    color: active ? color : 'var(--text-sub)',
    fontSize: 12, fontWeight: 600,
    display: 'flex', alignItems: 'center', gap: 4,
  }),
  primaryBtn: (disabled) => ({
    width: '100%', padding: '13px 0', borderRadius: 12, border: 'none',
    background: disabled ? 'var(--surface-alt)' : 'var(--text)',
    color: disabled ? 'var(--text-muted)' : 'var(--bg)',
    fontSize: 14, fontWeight: 700, cursor: disabled ? 'default' : 'pointer',
    fontFamily: 'inherit', transition: 'background 0.15s',
  }),
  categoryChip: (active, color) => ({
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    gap: 4, padding: '10px 8px', borderRadius: 12, cursor: 'pointer',
    border: `1.5px solid ${active ? color : 'var(--border)'}`,
    background: active ? color + '15' : 'var(--surface)',
    flex: 1, minWidth: 52,
  }),
  catIcon: { fontSize: 20 },
  catLabel: (active, color) => ({
    fontSize: 10, fontWeight: 700, letterSpacing: '0.04em',
    color: active ? color : 'var(--text-muted)', textTransform: 'uppercase',
  }),
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function Avatar({ icon, size = 44 }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      background: 'var(--surface-alt)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: size * 0.45, flexShrink: 0,
    }}>
      {icon}
    </div>
  );
}

function InitialsAvatar({ name, color, size = 44 }) {
  const initials = name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      background: color + '22',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: size * 0.3, fontWeight: 700, color, flexShrink: 0,
    }}>
      {initials}
    </div>
  );
}

// ─── Celebration Screen ───────────────────────────────────────────────────────

function CelebrationScreen({ streak, onDismiss, todayKey }) {
  const current = calcStreak(streak.checkIns, todayKey);
  return (
    <div style={S.celebOverlay}>
      <div style={{ fontSize: 64, marginBottom: 12 }}>{streak.icon}</div>
      <div style={S.celebNum}>{current}</div>
      <div style={S.celebTitle}>
        {streak.type === 'shared' && streak.partnerName
          ? `You and ${streak.partnerName} kept the streak!`
          : 'Streak saved!'}
      </div>
      <div style={S.celebSub}>{streak.title} · Day {current}</div>
      <button style={S.continueBtn} onClick={onDismiss}>Continue</button>
    </div>
  );
}

// ─── Active Streak Card ───────────────────────────────────────────────────────

function ActiveStreakCard({ streak, onCheckIn, onAbandon, todayKey }) {
  const cat = CATEGORIES.find(c => c.id === streak.category) || CATEGORIES[4];
  const color = cat.color;
  const days = streak.duration ? getDayKeys(streak.startDate, streak.duration) : [];
  const doneCount = days.filter(d => streak.checkIns[d]).length;
  const pct = days.length > 0 ? Math.round((doneCount / days.length) * 100) : 0;
  const current = calcStreak(streak.checkIns, todayKey);
  const weekDays = useMemo(() => getWeekDays(todayKey), [todayKey]);
  const todayDone = !!streak.checkIns[todayKey];

  return (
    <div style={S.detailCard}>
      <div style={S.detailTop(color)}>
        <div style={S.detailIconRow}>
          <Avatar icon={streak.icon} size={40} />
          <div style={{ flex: 1 }}>
            <p style={S.detailTitle}>{streak.title}</p>
            {streak.description && <p style={S.detailDesc}>{streak.description}</p>}
          </div>
          {streak.type === 'shared' && streak.partnerName && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <InitialsAvatar name={streak.partnerName} color={color} size={28} />
              <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 500 }}>{streak.partnerName}</span>
            </div>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
          <span style={S.streakNum(color)}>{current}</span>
          <span style={S.streakLabel}>day streak</span>
          {days.length > 0 && (
            <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--text-muted)', fontWeight: 500 }}>
              {pct}% done
            </span>
          )}
        </div>
      </div>

      <div style={S.detailBottom}>
        <div style={S.weekRow}>
          {weekDays.map(({ key, isToday }) => (
            <div key={key} style={S.dot(!!streak.checkIns[key], isToday, color)} />
          ))}
        </div>
        <div style={S.milestoneRow}>
          {MILESTONES.map(m => {
            const unlocked = current >= m;
            return (
              <div key={m} style={S.milestone(unlocked, color)}>
                <span style={S.mNum(unlocked, color)}>{m}d</span>
              </div>
            );
          })}
        </div>
        <button style={S.checkBtn(todayDone, color)} onClick={() => onCheckIn(streak.id)}>
          {todayDone ? '✓  Checked in today' : 'Check in today'}
        </button>
        <button style={S.abandonBtn} onClick={() => onAbandon(streak.id)}>Abandon streak</button>
      </div>
    </div>
  );
}

// ─── Streak Row (compact) ─────────────────────────────────────────────────────

function StreakRow({ streak, onTap, todayKey }) {
  const cat = CATEGORIES.find(c => c.id === streak.category) || CATEGORIES[4];
  const color = cat.color;
  const current = calcStreak(streak.checkIns, todayKey);
  const todayDone = !!streak.checkIns[todayKey];

  return (
    <div style={S.streakRow} onClick={() => onTap(streak.id)}>
      <Avatar icon={streak.icon} size={40} />
      <div style={{ flex: 1 }}>
        <p style={S.rowTitle}>{streak.title}</p>
        {streak.type === 'shared' && streak.partnerName && (
          <p style={S.rowSub}>with {streak.partnerName}</p>
        )}
      </div>
      <div style={S.streakBadge(color)}>
        <span style={{ fontSize: 14 }}>🔥</span>
        <span style={S.badgeCount(color)}>{current}</span>
        {todayDone && <span style={{ fontSize: 10, color, fontWeight: 700 }}>✓</span>}
      </div>
    </div>
  );
}

// ─── History Card ─────────────────────────────────────────────────────────────

function HistoryCard({ streak, onDelete }) {
  const cat = CATEGORIES.find(c => c.id === streak.category) || CATEGORIES[4];
  const color = cat.color;
  const best = streak.bestStreak || 0;
  const statusLabel = streak.status === 'completed' ? 'Completed' : 'Abandoned';
  const endDate = streak.completedDate || streak.abandonedDate;
  const endLabel = endDate
    ? new Date(endDate + 'T12:00:00').toLocaleDateString('en', { month: 'short', day: 'numeric' })
    : '';

  return (
    <div style={{ ...S.streakRow, opacity: streak.status === 'abandoned' ? 0.6 : 1 }}>
      <Avatar icon={streak.icon} size={40} />
      <div style={{ flex: 1 }}>
        <p style={S.rowTitle}>{streak.title}</p>
        <p style={S.rowSub}>{statusLabel}{endLabel ? ` · ${endLabel}` : ''}</p>
      </div>
      <div style={S.streakBadge(color)}>
        <span style={{ fontSize: 13 }}>🔥</span>
        <span style={S.badgeCount(color)}>{best}</span>
      </div>
      <button
        onClick={e => { e.stopPropagation(); onDelete(streak.id); }}
        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 16, padding: '0 0 0 8px' }}
      >×</button>
    </div>
  );
}

// ─── Personal Create Sheet ────────────────────────────────────────────────────
// Personal tab: straight to form (no solo/shared choice)

function PersonalCreateSheet({ open, onClose, onCreate, todayKey }) {
  const [title, setTitle] = useState('');
  const [desc, setDesc] = useState('');
  const [duration, setDuration] = useState(7);
  const [openEnded, setOpenEnded] = useState(false);

  useEffect(() => {
    if (!open) { setTitle(''); setDesc(''); setDuration(7); setOpenEnded(false); }
  }, [open]);

  const handleCreate = () => {
    if (!title.trim()) return;
    onCreate({
      id: genId(), type: 'solo',
      title: title.trim(), description: desc.trim(),
      icon: '🔥', category: 'lifestyle',
      duration: openEnded ? null : duration,
      partnerName: null, mode: null,
      createdAt: todayKey, startDate: todayKey,
      status: 'active', checkIns: {},
      checkInsU2: null, completedDate: null, abandonedDate: null,
    });
    onClose();
  };

  if (!open) return null;

  return (
    <div style={S.sheet} onClick={onClose}>
      <div style={S.sheetInner} onClick={e => e.stopPropagation()}>
        <div style={S.sheetHandle} />
        <p style={S.sheetTitle}>New streak</p>
        <p style={S.sheetSub}>Build a daily habit, one day at a time</p>

        <div style={{ padding: '20px 0 0' }}>
          {/* Title */}
          <div style={S.field}>
            <label style={S.label}>Title</label>
            <input
              style={S.inputStyle}
              placeholder="e.g. Drink 8 glasses of water"
              value={title}
              onChange={e => setTitle(e.target.value)}
            />
          </div>

          {/* Description */}
          <div style={S.field}>
            <label style={S.label}>Description</label>
            <input
              style={S.inputStyle}
              placeholder="Optional — add a note"
              value={desc}
              onChange={e => setDesc(e.target.value)}
            />
          </div>

          {/* Duration */}
          <div style={S.field}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <label style={{ ...S.label, margin: 0 }}>Duration</label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-muted)', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={openEnded}
                  onChange={e => setOpenEnded(e.target.checked)}
                  style={{ accentColor: 'var(--text)' }}
                />
                Open-ended
              </label>
            </div>
            {!openEnded && (
              <div style={S.chipRow}>
                {DURATION_OPTS.map(d => (
                  <button key={d} style={S.chip(duration === d, 'var(--text)')} onClick={() => setDuration(d)}>
                    {d}d
                  </button>
                ))}
              </div>
            )}
          </div>

          <div style={{ padding: '0 20px 8px' }}>
            <button style={S.primaryBtn(!title.trim())} disabled={!title.trim()} onClick={handleCreate}>
              Start streak
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Shared Create Sheet ──────────────────────────────────────────────────────
// Shared tab: pick friend first → then configure streak

function SharedCreateSheet({ open, onClose, onCreate, todayKey, friends, uid }) {
  const [step, setStep] = useState('friend');  // 'friend' | 'form'
  const [selectedFriend, setSelectedFriend] = useState(null);
  const [title, setTitle] = useState('');
  const [desc, setDesc] = useState('');
  const [duration, setDuration] = useState(30);
  const [openEnded, setOpenEnded] = useState(false);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!open) {
      setStep('friend'); setSelectedFriend(null); setTitle(''); setDesc('');
      setDuration(30); setOpenEnded(false); setSending(false);
    }
  }, [open]);

  const handleCreate = async () => {
    if (!title.trim() || !selectedFriend || sending) return;
    setSending(true);
    try {
      const chatId = await ensureChatExists(uid, selectedFriend.id);
      const prof = await getUserProfile(uid).catch(() => null);
      await sendStreakInvite(chatId, uid, prof?.displayName || 'Someone', {
        title: title.trim(),
        description: desc.trim(),
        duration: openEnded ? null : duration,
      });
      onCreate({
        id: genId(), type: 'shared',
        title: title.trim(), description: desc.trim(),
        icon: '🔥', category: 'lifestyle',
        duration: openEnded ? null : duration,
        partnerName: selectedFriend.displayName || selectedFriend.name || '',
        mode: 'both',
        createdAt: todayKey, startDate: todayKey,
        status: 'active', checkIns: {}, checkInsU2: {},
        completedDate: null, abandonedDate: null,
      });
      onClose();
    } catch (e) {
      console.warn('Failed to send invite:', e);
    }
    setSending(false);
  };

  if (!open) return null;

  return (
    <div style={S.sheet} onClick={onClose}>
      <div style={S.sheetInner} onClick={e => e.stopPropagation()}>
        <div style={S.sheetHandle} />

        {/* Step 1: Pick a friend */}
        {step === 'friend' && (
          <>
            <p style={S.sheetTitle}>Find a buddy</p>
            <p style={S.sheetSub}>Pick a friend to start a shared streak with</p>

            {(!friends || friends.length === 0) ? (
              <div style={S.empty}>
                <div style={S.emptyIcon}>👥</div>
                <p style={S.emptyTitle}>No friends yet</p>
                <p style={{ ...S.sheetSub, maxWidth: 240 }}>
                  Follow other users to start shared streaks with them
                </p>
              </div>
            ) : friends.map(f => (
              <div
                key={f.id}
                style={S.friendRow(selectedFriend?.id === f.id)}
                onClick={() => setSelectedFriend(f)}
              >
                {f.photoURL ? (
                  <div style={{ width: 44, height: 44, borderRadius: '50%', overflow: 'hidden', flexShrink: 0 }}>
                    <img src={f.photoURL} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} referrerPolicy="no-referrer" />
                  </div>
                ) : (
                  <InitialsAvatar name={f.displayName || 'User'} color="#888" size={44} />
                )}
                <div style={{ flex: 1 }}>
                  <p style={S.rowTitle}>{f.displayName || 'User'}</p>
                  <p style={S.rowSub}>@{f.handle || 'user'}</p>
                </div>
                {selectedFriend?.id === f.id && (
                  <span style={{ color: '#1CE3A0', fontSize: 20, fontWeight: 700 }}>✓</span>
                )}
              </div>
            ))}

            <div style={{ padding: '16px 20px 0' }}>
              <button
                style={S.primaryBtn(!selectedFriend)}
                disabled={!selectedFriend}
                onClick={() => { if (selectedFriend) setStep('form'); }}
              >
                Continue with {selectedFriend ? (selectedFriend.displayName || selectedFriend.name || '').split(' ')[0] : '...'}
              </button>
            </div>
          </>
        )}

        {/* Step 2: Configure the streak */}
        {step === 'form' && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '18px 20px 12px' }}>
              <button
                onClick={() => setStep('friend')}
                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: 'var(--text)', padding: 0 }}
              >←</button>
              <p style={{ ...S.sheetTitle, padding: 0, margin: 0 }}>
                Streak with {(selectedFriend?.displayName || selectedFriend?.name || '').split(' ')[0]}
              </p>
              {selectedFriend?.photoURL ? (
                <div style={{ width: 28, height: 28, borderRadius: '50%', overflow: 'hidden', flexShrink: 0 }}>
                  <img src={selectedFriend.photoURL} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} referrerPolicy="no-referrer" />
                </div>
              ) : (
                <InitialsAvatar name={selectedFriend?.displayName || selectedFriend?.name || ''} color="#888" size={28} />
              )}
            </div>
            <p style={{ ...S.sheetSub, paddingTop: 0 }}>
              Set up your challenge — both of you will check in daily
            </p>

            <div style={{ padding: '16px 0 0' }}>
              {/* Title */}
              <div style={S.field}>
                <label style={S.label}>Challenge name</label>
                <input
                  style={S.inputStyle}
                  placeholder="e.g. 30-day water challenge"
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                />
              </div>

              {/* Description */}
              <div style={S.field}>
                <label style={S.label}>Description</label>
                <input
                  style={S.inputStyle}
                  placeholder="Optional — describe the challenge"
                  value={desc}
                  onChange={e => setDesc(e.target.value)}
                />
              </div>

              {/* Duration */}
              <div style={S.field}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <label style={{ ...S.label, margin: 0 }}>Duration</label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-muted)', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={openEnded}
                      onChange={e => setOpenEnded(e.target.checked)}
                      style={{ accentColor: 'var(--text)' }}
                    />
                    Open-ended
                  </label>
                </div>
                {!openEnded && (
                  <div style={S.chipRow}>
                    {DURATION_OPTS.map(d => (
                      <button key={d} style={S.chip(duration === d, 'var(--text)')} onClick={() => setDuration(d)}>
                        {d}d
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div style={{ padding: '0 20px 8px' }}>
                <button style={{ ...S.primaryBtn(!title.trim() || sending) }} disabled={!title.trim() || sending} onClick={handleCreate}>
                  {sending ? 'Sending...' : `Send invite to ${selectedFriend ? (selectedFriend.displayName || selectedFriend.name || '').split(' ')[0] : ''}`}
                </button>
                <button
                  onClick={onClose}
                  style={{
                    background: 'none', border: 'none', width: '100%',
                    padding: '12px 0 0', fontSize: 13, color: 'var(--text-muted)',
                    cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600,
                    letterSpacing: '0.04em', textTransform: 'uppercase',
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function Streaks({ store, user }) {
  const todayKey = store?.todayKey || fmtKey(new Date());
  const uid = user?.uid || '';
  const [streaks, setStreaks] = useState(() => load(uid));
  const [tab, setTab] = useState('personal');
  const [showPersonalCreate, setShowPersonalCreate] = useState(false);
  const [showSharedCreate, setShowSharedCreate] = useState(false);
  const [expandedId, setExpandedId] = useState(null);
  const [celebStreak, setCelebStreak] = useState(null);

  const [pending, setPending] = useState([]);

  // Friend search
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [viewingFriend, setViewingFriend] = useState(null);
  const [friends, setFriends] = useState([]);
  const [friendIds, setFriendIds] = useState([]);
  const [outgoingIds, setOutgoingIds] = useState([]);
  const [incomingIds, setIncomingIds] = useState([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showMessages, setShowMessages] = useState(false);
  const [chatPartner, setChatPartner] = useState(null);
  const [confirmAction, setConfirmAction] = useState(null);
  useEffect(() => { if (uid) save(uid, streaks); }, [streaks, uid]);

  const anyOverlayOpen = showPersonalCreate || showSharedCreate || showNotifications || showMessages || !!celebStreak || !!viewingFriend || !!confirmAction;
  useEffect(() => {
    const el = document.getElementById('app-content-scroll');
    if (!el) return;
    el.style.overflowY = anyOverlayOpen ? 'hidden' : 'auto';
    return () => { el.style.overflowY = 'auto'; };
  }, [anyOverlayOpen]);

  // Friend search debounce
  useEffect(() => {
    if (!searchQuery.trim() || !uid) { setSearchResults([]); return; }
    const t = setTimeout(async () => {
      setSearching(true);
      try {
        const results = await searchUsers(searchQuery, uid);
        setSearchResults(results);
      } catch {} finally { setSearching(false); }
    }, 300);
    return () => clearTimeout(t);
  }, [searchQuery, uid]);

  // Load friends list, friend requests, and notifications
  useEffect(() => {
    if (!uid) return;
    (async () => {
      try {
        const p = await getUserProfile(uid);
        setFriendIds(p?.friends || []);
        setOutgoingIds((p?.friendRequests?.outgoing || []).map(r => r.uid || r));
        setIncomingIds((p?.friendRequests?.incoming || []).map(r => r.uid || r));
        const incoming = p?.friendRequests?.incoming || [];
        if (incoming.length > 0) {
          const items = await Promise.all(incoming.map(async r => {
            const uid2 = r.uid || r;
            const prof = await getUserProfile(uid2).catch(() => null);
            if (!prof) return null;
            return {
              id: genId(), fromName: prof.displayName || 'User',
              fromUid: prof.id, createdAt: r.createdAt || 0,
            };
          }));
          setPending(items.filter(Boolean).sort((a, b) => b.createdAt - a.createdAt));
        }
        // Load friend profiles
        if (p?.friends?.length) {
          const profiles = await Promise.all(p.friends.map(fid => getUserProfile(fid)));
          setFriends(profiles.filter(Boolean));
        } else {
          setFriends([]);
        }
      } catch {}
    })();
  }, [uid]);

  const handleSendRequest = async (toUid, toName) => {
    try {
      await sendFriendRequest(uid, toUid);
      setOutgoingIds(prev => [...prev, toUid]);
      store.refreshFriends();
    } catch (e) {
      if (e.message === 'Request already sent' || e.message === 'Already friends') return;
      alert(e.message);
    }
  };

  const handleUnfollow = async (toUid) => {
    setConfirmAction({
      message: 'Unfollow this user?',
      onConfirm: async () => {
        setConfirmAction(null);
        try {
          if (friendIds.includes(toUid)) {
            await removeFriend(uid, toUid);
            setFriendIds(prev => prev.filter(id => id !== toUid));
            setFriends(prev => prev.filter(f => f.id !== toUid));
          } else {
            await cancelFriendRequest(uid, toUid);
            setOutgoingIds(prev => prev.filter(id => id !== toUid));
          }
          store.refreshFriends();
        } catch (e) { console.warn(e); }
      },
    });
  };

  const handleRemoveFriend = async (friendUid) => {
    setConfirmAction({
      message: 'Remove this friend?',
      onConfirm: async () => {
        setConfirmAction(null);
        try { await removeFriend(uid, friendUid); setFriendIds(prev => prev.filter(id => id !== friendUid)); setFriends(prev => prev.filter(f => f.id !== friendUid)); store.refreshFriends(); }
        catch (e) { alert(e.message); }
      }
    });
  };

  const personalActive = streaks.filter(s => s.status === 'active' && s.type !== 'shared');
  const sharedActive   = streaks.filter(s => s.status === 'active' && s.type === 'shared');

  const handleCheckIn = useCallback((id) => {
    setStreaks(prev => prev.map(s => {
      if (s.id !== id) return s;
      const checkIns = { ...s.checkIns };
      if (checkIns[todayKey]) {
        delete checkIns[todayKey];
      } else {
        checkIns[todayKey] = true;
        setTimeout(() => setCelebStreak({ ...s, checkIns }), 100);
      }
      const days = s.duration ? getDayKeys(s.startDate, s.duration) : [];
      const doneCount = days.filter(d => checkIns[d]).length;
      const completed = s.duration && doneCount >= s.duration;
      return { ...s, checkIns, status: completed ? 'completed' : 'active', completedDate: completed ? todayKey : null };
    }));
  }, [todayKey]);

  const handleAbandon = useCallback((id) => {
    setStreaks(prev => prev.map(s => {
      if (s.id !== id) return s;
      const streakVal = calcStreak(s.checkIns, todayKey);
      return { ...s, status: 'abandoned', abandonedDate: todayKey, bestStreak: Math.max(s.bestStreak || 0, streakVal) };
    }));
    setExpandedId(null);
  }, [todayKey]);

  const handleDelete = useCallback((id) => {
    setStreaks(prev => prev.filter(s => s.id !== id));
  }, []);

  const handleCreate = useCallback((data) => {
    setStreaks(prev => [...prev, data]);
  }, []);

  const acceptPending = async (id) => {
    const p = pending.find(x => x.id === id);
    if (!p) return;
    // Remove from pending and add to friends immediately
    setPending(prev => prev.filter(x => x.id !== id));
    setIncomingIds(prev => prev.filter(fid => fid !== p.fromUid));
    setFriendIds(prev => [...prev, p.fromUid]);
    try {
      await acceptFriendRequest(uid, p.fromUid);
      const prof = await getUserProfile(p.fromUid);
      if (prof) setFriends(prev => [...prev, prof]);
      store.refreshFriends();
    } catch (e) { console.warn('acceptFriendRequest failed:', e); }
  };

  const declinePending = async (id) => {
    const p = pending.find(x => x.id === id);
    if (!p) return;
    try {
      await declineFriendRequest(uid, p.fromUid);
      setPending(prev => prev.filter(x => x.id !== id));
      setIncomingIds(prev => prev.filter(fid => fid !== p.fromUid));
    } catch {}
  };

  const handleFabPress = () => {
    if (tab === 'personal') setShowPersonalCreate(true);
    else if (tab === 'shared') setShowSharedCreate(true);
  };

  const activeList = tab === 'personal' ? personalActive : tab === 'shared' ? sharedActive : [];

  // Group notifications by time
  const grouped = useMemo(() => {
    const now = Date.now();
    const day = 86400000;
    const groups = { today: [], week: [], month: [], older: [] };
    pending.forEach(p => {
      const age = now - (p.createdAt || 0);
      if (age < day) groups.today.push(p);
      else if (age < 7 * day) groups.week.push(p);
      else if (age < 30 * day) groups.month.push(p);
      else groups.older.push(p);
    });
    return groups;
  }, [pending]);

  const groupLabels = [
    { key: 'today', label: 'Today' },
    { key: 'week', label: 'This Week' },
    { key: 'month', label: 'Last 30 Days' },
    { key: 'older', label: 'Older' },
  ];

  return (
    <>
      <style>{cssVars}</style>
      <div style={{ ...S.screen, position: 'relative' }}>

        {/* Header */}
        <div style={S.header}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0, color: 'var(--text)' }}>Streaks</h1>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <button
                onClick={() => setShowMessages(true)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, display: 'flex', alignItems: 'center' }}
              >
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--text)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                </svg>
              </button>
              <button
                onClick={() => setShowNotifications(true)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, position: 'relative', display: 'flex', alignItems: 'center' }}
              >
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--text)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                  <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                </svg>
                {pending.length > 0 && (
                  <span style={{
                    position: 'absolute', top: 2, right: 2, width: 8, height: 8,
                    borderRadius: '50%', background: 'var(--text-muted)',
                  }} />
                )}
              </button>
            </div>
          </div>

          {/* Friend Search */}
          <div style={{ padding: '12px 0 4px' }}>
            <label style={{
              display: 'flex', gap: 8, alignItems: 'center', cursor: 'text',
              background: 'var(--bg)', border: '1.5px solid var(--border)',
              borderRadius: 12, padding: '0 14px', transition: 'border-color 0.15s',
            }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                <circle cx="11" cy="11" r="8" />
                <path d="m21 21-4.35-4.35" />
              </svg>
              <input
                style={{
                  flex: 1, background: 'none', border: 'none',
                  fontSize: 14, color: 'var(--text)', fontFamily: 'inherit',
                  padding: '12px 0', outline: 'none', width: '100%',
                }}
                placeholder="Search by @username..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
            </label>
            {searching && <div style={{ fontSize: 11, color: 'var(--text-muted)', padding: '6px 0 0' }}>Searching...</div>}
            {searchResults.length > 0 && (
              <div style={{ marginTop: 8, borderRadius: 12, border: '1px solid var(--border)', overflow: 'hidden' }}>
                {searchResults.map(u => (
                  <div key={u.id} style={{
                    display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px',
                    borderBottom: '1px solid var(--border)', cursor: 'pointer',
                    background: 'var(--surface)',
                  }}>
                    <div onClick={() => setViewingFriend(u)} style={{
                      display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0,
                    }}>
                      <div style={{
                        width: 36, height: 36, borderRadius: '50%',
                        background: 'var(--surface-alt)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 13, fontWeight: 700, color: 'var(--text-sub)', overflow: 'hidden', flexShrink: 0,
                      }}>
                        {u.photoURL ? (
                          <img src={u.photoURL} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} referrerPolicy="no-referrer" />
                        ) : getInitials(u.displayName)}
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>{u.displayName || 'User'}</div>
                        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>@{u.handle}</div>
                      </div>
                    </div>
                    {(() => {
                      if (friendIds.includes(u.id)) {
                        return (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                            <button
                              onClick={() => { setChatPartner(u); setShowMessages(true); }}
                              style={{
                                fontSize: 11, fontWeight: 700, color: '#1CE3A0',
                                background: '#1CE3A018', border: '1px solid #1CE3A030',
                                borderRadius: 8, padding: '5px 10px', cursor: 'pointer',
                                fontFamily: 'inherit', flexShrink: 0,
                              }}
                            >Message</button>
                            <button onClick={() => handleUnfollow(u.id)} style={{
                              fontSize: 11, fontWeight: 700, color: 'var(--text-muted)',
                              background: 'var(--surface-alt)', border: '1px solid var(--border)',
                              borderRadius: 8, padding: '5px 10px', cursor: 'pointer',
                              fontFamily: 'inherit', flexShrink: 0,
                            }}>Following</button>
                          </div>
                        );
                      }
                      if (outgoingIds.includes(u.id)) {
                        return (
                          <button onClick={() => handleUnfollow(u.id)} style={{
                            fontSize: 11, fontWeight: 600, color: 'var(--text-muted)',
                            background: 'none', border: 'none',
                            padding: '5px 12px', cursor: 'pointer',
                            fontFamily: 'inherit', flexShrink: 0,
                          }}>Following</button>
                        );
                      }
                      return (
                        <button onClick={() => handleSendRequest(u.id, u.displayName)} style={{
                          fontSize: 11, fontWeight: 700, color: '#1CE3A0',
                          background: '#1CE3A018', border: '1px solid #1CE3A030',
                          borderRadius: 8, padding: '5px 12px', cursor: 'pointer',
                          fontFamily: 'inherit', flexShrink: 0,
                        }}>Follow</button>
                      );
                    })()}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div style={S.tabRow}>
            {['personal', 'shared', 'friends'].map(t => (
              <button key={t} style={S.tab(tab === t)} onClick={() => setTab(t)}>
                {t === 'personal' ? 'Personal' : t === 'shared' ? 'Shared' : 'Friends'}
              </button>
            ))}
          </div>
        </div>

        {/* Active streaks */}
        {tab === 'friends' ? (
          friends.length > 0 ? (
            <div style={{ padding: '8px 20px 4px' }}>
              <p style={S.sectionLabel}>Friends ({friends.length})</p>
              {friends.map(u => (
                <div key={u.id} style={{ ...S.streakRow, padding: '10px 20px' }}>
                  <div onClick={() => setViewingFriend(u)} style={{
                    display: 'flex', alignItems: 'center', gap: 10, flex: 1, cursor: 'pointer', minWidth: 0,
                  }}>
                    <div style={{
                      width: 36, height: 36, borderRadius: '50%',
                      background: 'var(--surface-alt)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 13, fontWeight: 700, color: 'var(--text-sub)', overflow: 'hidden', flexShrink: 0,
                    }}>
                      {u.photoURL ? (
                        <img src={u.photoURL} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} referrerPolicy="no-referrer" />
                      ) : getInitials(u.displayName)}
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={S.rowTitle}>{u.displayName || 'User'}</div>
                      <div style={S.rowSub}>@{u.handle}</div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <button
                      onClick={() => { setChatPartner(u); setShowMessages(true); }}
                      style={{
                        fontSize: 11, fontWeight: 700, color: '#1CE3A0',
                        background: '#1CE3A018', border: '1px solid #1CE3A030',
                        borderRadius: 8, padding: '5px 12px', cursor: 'pointer',
                        fontFamily: 'inherit', flexShrink: 0,
                      }}
                    >Message</button>
                    <button onClick={() => handleRemoveFriend(u.id)} style={{
                      fontSize: 11, fontWeight: 600, color: 'var(--text-muted)',
                      background: 'none', border: 'none', cursor: 'pointer',
                      fontFamily: 'inherit', flexShrink: 0,
                    }}>Remove</button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div style={S.empty}>
              <div style={S.emptyIcon}>👥</div>
              <h2 style={S.emptyTitle}>No friends yet</h2>
              <p style={S.emptyDesc}>Search for users by @username and follow them.</p>
            </div>
          )
        ) : activeList.length > 0 ? (
          <>
            <p style={S.sectionLabel}>{tab === 'shared' ? 'Shared streaks' : 'Active'}</p>
            {activeList.map(s => (
              <div key={s.id}>
                <StreakRow
                  streak={s}
                  onTap={(id) => setExpandedId(expandedId === id ? null : id)}
                  todayKey={todayKey}
                />
                {expandedId === s.id && (
                  <ActiveStreakCard
                    streak={s}
                    onCheckIn={handleCheckIn}
                    onAbandon={handleAbandon}
                    todayKey={todayKey}
                  />
                )}
              </div>
            ))}

            {/* "Find a partner" row in shared tab */}
            {tab === 'shared' && (
              <div
                style={{ ...S.streakRow, color: 'var(--text-muted)', fontSize: 13, fontWeight: 500, gap: 10 }}
                onClick={() => setShowSharedCreate(true)}
              >
                <div style={{
                  width: 40, height: 40, borderRadius: '50%',
                  border: '1.5px dashed var(--border)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 18, color: 'var(--text-muted)',
                }}>+</div>
                <span>Find a partner</span>
              </div>
            )}
          </>
        ) : (
          <div style={S.empty}>
            <div style={S.emptyIcon}>{tab === 'shared' ? '👥' : '🔥'}</div>
            <h2 style={S.emptyTitle}>{tab === 'shared' ? 'No shared streaks yet' : 'No active streaks'}</h2>
            <p style={S.emptyDesc}>
              {tab === 'shared'
                ? 'Find a buddy and hold each other accountable every day.'
                : 'Start a habit and check in every day to build your streak.'}
            </p>
            <button
              style={{ ...S.primaryBtn(false), maxWidth: 200 }}
              onClick={handleFabPress}
            >
              {tab === 'shared' ? 'Find a partner' : 'Start a streak'}
            </button>
          </div>
        )}

        {/* Notifications fullscreen */}
        {showNotifications && (
          <div style={{
            position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
            zIndex: 300, background: 'var(--bg)',
            display: 'flex', flexDirection: 'column',
          }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '14px 16px', borderBottom: '1px solid var(--border)',
            }}>
              <button
                onClick={() => setShowNotifications(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, display: 'flex', alignItems: 'center' }}
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--text)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M19 12H5" /><path d="M12 19l-7-7 7-7" />
                </svg>
              </button>
              <p style={{ fontSize: 17, fontWeight: 700, color: 'var(--text)', margin: 0 }}>Notifications</p>
            </div>
            <div style={{ flex: 1, overflowY: 'auto' }}>
              {pending.length === 0 ? (
                <div style={S.empty}>
                  <div style={S.emptyIcon}>🔔</div>
                  <h2 style={S.emptyTitle}>No notifications</h2>
                  <p style={S.emptyDesc}>You're all caught up!</p>
                </div>
              ) : (
                groupLabels.map(({ key, label }) => {
                  const items = grouped[key];
                  if (!items.length) return null;
                  return (
                    <div key={key}>
                      <div style={{
                        fontSize: 13, fontWeight: 700, color: 'var(--text-muted)',
                        letterSpacing: '0.06em', textTransform: 'uppercase',
                        padding: '16px 20px 8px',
                      }}>{label}</div>
                      {items.map(p => (
                        <div key={p.id} style={{
                          display: 'flex', alignItems: 'center', gap: 10,
                          padding: '10px 20px',
                        }}>
                          <InitialsAvatar name={p.fromName} color="#E74C6F" size={40} />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>{p.fromName}</span>{' '}
                            <span style={{ fontSize: 14, color: 'var(--text-sub)' }}>started following you.</span>
                          </div>
                          <button
                                onClick={() => acceptPending(p.id)}
                                style={{
                                  padding: '7px 18px', borderRadius: 8, border: 'none',
                                  background: '#1CE3A0',
                                  color: '#0A5C3E',
                                  fontSize: 13, fontWeight: 700, cursor: 'pointer',
                                  fontFamily: 'inherit', flexShrink: 0, transition: 'all 0.15s',
                                }}
                              >Follow Back</button>
                        </div>
                      ))}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* Messages fullscreen */}
        {showMessages && (
          <Messages
            uid={uid}
            profileName={user?.displayName || ''}
            onClose={() => { setShowMessages(false); setChatPartner(null); }}
            store={store}
            initialPartner={chatPartner}
            onAcceptStreak={(data) => {
              const newStreak = {
                id: genId(), type: 'shared',
                title: data.title, description: data.description || '',
                icon: '🔥', category: 'lifestyle',
                duration: data.duration,
                partnerName: data.partnerName || '',
                mode: 'both',
                createdAt: todayKey, startDate: todayKey,
                status: 'active', checkIns: {}, checkInsU2: {},
                completedDate: null, abandonedDate: null,
              };
              setStreaks(prev => [...prev, newStreak]);
            }}
          />
        )}

        {/* Modals — portaled to stay inside phone frame */}
        {document.getElementById('modal-portal') && createPortal(
          <>
            <PersonalCreateSheet
              open={showPersonalCreate}
              onClose={() => setShowPersonalCreate(false)}
              onCreate={handleCreate}
              todayKey={todayKey}
            />
            <SharedCreateSheet
              open={showSharedCreate}
              onClose={() => setShowSharedCreate(false)}
              onCreate={handleCreate}
              todayKey={todayKey}
              friends={friends}
              uid={uid}
            />

            {celebStreak && (
              <CelebrationScreen
                streak={celebStreak}
                onDismiss={() => setCelebStreak(null)}
                todayKey={todayKey}
              />
            )}
            {viewingFriend && (
              <div style={S.sheet} onClick={() => setViewingFriend(null)}>
                <div style={S.sheetInner} onClick={e => e.stopPropagation()}>
                  <div style={S.sheetHandle} />
                  <div style={{ textAlign: 'center', padding: '20px 20px 12px' }}>
                    <div style={{
                      width: 64, height: 64, borderRadius: '50%', margin: '0 auto 10px',
                      background: viewingFriend.photoURL ? 'transparent' : 'var(--surface-alt)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 26, fontWeight: 700, color: 'var(--text-sub)', overflow: 'hidden',
                    }}>
                      {viewingFriend.photoURL ? (
                        <img src={viewingFriend.photoURL} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} referrerPolicy="no-referrer" />
                      ) : getInitials(viewingFriend.displayName)}
                    </div>
                    <p style={S.detailTitle}>{viewingFriend.displayName || 'User'}</p>
                    <p style={{ fontSize: 13, color: 'var(--text-muted)', fontWeight: 500 }}>@{viewingFriend.handle}</p>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, padding: '0 20px 24px' }}>
                    {[
                      { label: 'Days Active', value: viewingFriend.createdAt ? Math.max(1, Math.round((Date.now() - (viewingFriend.createdAt.toDate?.()?.getTime() || Date.now())) / 86400000)) : '—', color: 'var(--text)' },
                      { label: 'Friends', value: (viewingFriend.friends || []).length, color: 'var(--text)' },
                      { label: 'Avg Score', value: '—', color: 'var(--text-muted)' },
                    ].map(s => (
                      <div key={s.label} style={{ textAlign: 'center', padding: '12px 4px', background: 'var(--surface-alt)', borderRadius: 12 }}>
                        <div style={{ fontSize: 20, fontWeight: 700, color: s.color }}>{s.value}</div>
                        <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 600, marginTop: 2, letterSpacing: '0.04em' }}>{s.label.toUpperCase()}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
            {confirmAction && (
              <div style={{ position: 'absolute', inset: 0, zIndex: 500, background: 'var(--overlay)', backdropFilter: 'var(--overlay-blur)', display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => setConfirmAction(null)}>
                <div onClick={e => e.stopPropagation()} style={{
                  background: 'var(--surface)', borderRadius: 20, padding: 28, width: 280,
                  textAlign: 'center', boxShadow: '0 8px 40px rgba(0,0,0,0.2)',
                }}>
                  <p style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)', margin: '0 0 24px', lineHeight: 1.4 }}>{confirmAction.message}</p>
                  <div style={{ display: 'flex', gap: 10 }}>
                    <button onClick={() => setConfirmAction(null)} style={{
                      flex: 1, padding: '12px 0', borderRadius: 12, border: '1px solid var(--border)',
                      background: 'transparent', color: 'var(--text)', fontSize: 14, fontWeight: 600,
                      cursor: 'pointer', fontFamily: 'inherit',
                    }}>Cancel</button>
                    <button onClick={() => { confirmAction.onConfirm?.(); }} style={{
                      flex: 1, padding: '12px 0', borderRadius: 12, border: 'none',
                      background: 'var(--status-error)', color: '#fff', fontSize: 14, fontWeight: 600,
                      cursor: 'pointer', fontFamily: 'inherit',
                    }}>{confirmAction.confirmLabel || 'Remove'}</button>
                  </div>
                </div>
              </div>
            )}
          </>,
          document.getElementById('modal-portal')
        )}
      </div>
    </>
  );
}