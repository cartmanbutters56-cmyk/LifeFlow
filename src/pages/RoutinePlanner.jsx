import React, { useState, useEffect, useMemo } from 'react';

import { Modal, inputStyle, Portal } from '../components/UI';

const CATEGORIES = ['Exercise','Work','Study','Personal','Health'];
const CAT_COLORS = { Exercise:'var(--cat-rose)', Work:'var(--cat-violet)', Study:'var(--cat-blue)', Personal:'var(--cat-amber)', Health:'var(--cat-coral)' };
const CAT_ICONS = {
  Exercise: () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="15" height="15"><path d="M6.5 6.5l11 11M17.5 6.5L12 12l-5.5 5.5M7 17l-3 3M17 7l3-3"/></svg>,
  Work: () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="15" height="15"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/></svg>,
  Study: () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="15" height="15"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>,
  Personal: () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="15" height="15"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>,
  Health: () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="15" height="15"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>,
};

const DAYS_MAP = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
const QUOTES = [
  '"The secret of your success is found in your daily routine."',
  '"Small daily improvements lead to stunning results."',
  '"Discipline is choosing between what you want now and what you want most."',
  '"You don\'t rise to the level of your goals. You fall to the level of your systems."',
  '"Motivation gets you started. Habit keeps you going."',
];

function formatTime(time) {
  if (!time) return '';
  const [h, m] = time.split(':');
  const hour = parseInt(h);
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const h12 = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
  return `${h12}:${m} ${ampm}`;
}

function computeEndTime(time, duration) {
  const [h, m] = time.split(':').map(Number);
  const totalMin = h * 60 + m + (duration || 60);
  const endH = Math.floor(totalMin / 60);
  const endM = totalMin % 60;
  return `${String(endH).padStart(2,'0')}:${String(endM).padStart(2,'0')}`;
}

function getTimeRemaining(time) {
  const [h, m] = time.split(':').map(Number);
  const now = new Date();
  const target = new Date();
  target.setHours(h, m, 0, 0);
  const diff = target - now;
  if (diff <= 0) return null;
  const hours = Math.floor(diff / 3600000);
  const minutes = Math.floor((diff % 3600000) / 60000);
  if (hours > 0) return hours + 'h ' + minutes + 'm';
  return minutes + 'm';
}

function toLocalDateKey(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function get5DayDates() {
  const today = new Date();
  return [-2, -1, 0, 1, 2].map(offset => {
    const d = new Date(today);
    d.setDate(today.getDate() + offset);
    return {
      date: d,
      dayName: d.toLocaleDateString('en-US', { weekday: 'short' }),
      dayNum: d.getDate(),
      month: d.toLocaleDateString('en-US', { month: 'short' }),
      isToday: offset === 0,
      isPast: offset < 0,
      dateKey: toLocalDateKey(d),
      dayOfWeek: DAYS_MAP[d.getDay()],
    };
  });
}

function getNextRoutine(routines, isRoutineDone, dateKey) {
  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const upcoming = routines
    .filter(r => !isRoutineDone(r.id, dateKey))
    .sort((a, b) => a.time.localeCompare(b.time))
    .find(r => {
      const [h, m] = r.time.split(':').map(Number);
      return (h * 60 + m) > currentMinutes;
    });
  return upcoming || null;
}

function RoutineModal({ open, onClose, onSave, initial }) {
  const [title, setTitle] = useState(initial?.title || '');
  const [category, setCategory] = useState(initial?.category || 'Exercise');
  const [time, setTime] = useState(initial?.time || '08:00');
  const [selectedDays, setSelectedDays] = useState(initial?.days || ['Mon','Tue','Wed','Thu','Fri']);
  const [duration, setDuration] = useState(initial?.duration || 60);

  const toggleDay = (d) => setSelectedDays(prev =>
    prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d]);

  const submit = () => {
    if (!title.trim()) return;
    onSave({
      title: title.trim(), category, time, days: selectedDays,
      duration: parseInt(duration) || 60,
      color: CAT_COLORS[category],
    });
    if (!initial) { setTitle(''); setSelectedDays(['Mon','Tue','Wed','Thu','Fri']); setDuration(60); }
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title={initial ? 'Edit Routine' : 'New Routine'}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div>
          <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.06em', display: 'block', marginBottom: 7 }}>NAME</label>
          <input style={inputStyle} placeholder="e.g. Morning Workout" value={title} onChange={e => setTitle(e.target.value)} />
        </div>
        <div>
          <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.06em', display: 'block', marginBottom: 9 }}>CATEGORY</label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {CATEGORIES.map(c => {
              const color = CAT_COLORS[c];
              const active = category === c;
              return (
                <button key={c} onClick={() => setCategory(c)} style={{
                  padding: '7px 14px', borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: 'pointer',
                  border: `1.5px solid ${active ? color : 'var(--border)'}`,
                  background: active ? color + '18' : 'var(--glass)',
                  color: active ? color : 'var(--text-secondary)',
                  display: 'flex', alignItems: 'center', gap: 6,
                }}>
                  <span style={{ color: active ? color : 'var(--text-muted)' }}>{CAT_ICONS[c]?.()}</span>
                  {c}
                </button>
              );
            })}
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.06em', display: 'block', marginBottom: 7 }}>TIME</label>
            <input type="time" style={{ ...inputStyle }} value={time} onChange={e => setTime(e.target.value)} />
          </div>
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.06em', display: 'block', marginBottom: 7 }}>DURATION (min)</label>
            <input type="number" min="5" step="5" style={inputStyle} value={duration} onChange={e => setDuration(e.target.value)} />
          </div>
        </div>
        <div>
          <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.06em', display: 'block', marginBottom: 9 }}>REPEAT ON</label>
          <div style={{ display: 'flex', gap: 6 }}>
            {['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map(d => {
              const active = selectedDays.includes(d);
              return (
                <button key={d} onClick={() => toggleDay(d)} style={{
                  flex: 1, padding: '9px 0', borderRadius: 10, fontSize: 12, fontWeight: 700, cursor: 'pointer',
                  border: `1.5px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
                  background: active ? 'var(--accent-soft)' : 'transparent',
                  color: active ? 'var(--accent)' : 'var(--text-muted)',
                }}>{d[0]}</button>
              );
            })}
          </div>
        </div>
        <button onClick={submit} style={{
          marginTop: 4, padding: '13px 22px', borderRadius: 14,
          background: 'var(--accent)', border: 'none', color: '#fff',
          fontSize: 15, fontWeight: 700, cursor: 'pointer',
          fontFamily: 'inherit',
          boxShadow: '0 4px 16px var(--accent-soft)',
        }}>{initial ? 'Save Changes' : 'Add Routine'}</button>
      </div>
    </Modal>
  );
}

function ConfirmDeleteModal({ open, onClose, onConfirm, title }) {
  if (!open) return null;
  return (
    <Portal>
    <div onClick={onClose} style={{
      position: 'absolute', inset: 0, zIndex: 1100,
      background: 'var(--overlay)', backdropFilter: 'var(--overlay-blur)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        width: 300, background: 'var(--card)', borderRadius: 24, padding: 28,
        boxShadow: '0 24px 80px rgba(0,0,0,0.3)',
        animation: 'popIn 0.25s cubic-bezier(0.34,1.56,0.64,1)',
      }}>
        <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text)', fontFamily: "'Outfit', sans-serif", marginBottom: 8 }}>
          Delete Routine
        </div>
        <div style={{ fontSize: 14, color: 'var(--text-muted)', marginBottom: 20, lineHeight: 1.5 }}>
          Are you sure you want to delete <strong style={{ color: 'var(--text)' }}>"{title}"</strong>?
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={onClose} style={{
            flex: 1, padding: '11px', borderRadius: 12,
            border: '1.5px solid var(--border)', background: 'transparent',
            color: 'var(--text)', fontSize: 14, fontWeight: 600, cursor: 'pointer',
            fontFamily: 'inherit',
          }}>Cancel</button>
          <button onClick={onConfirm} style={{
            flex: 1, padding: '11px', borderRadius: 12,
            border: 'none', background: 'var(--coral)', color: '#fff',
            fontSize: 14, fontWeight: 600, cursor: 'pointer',
            fontFamily: 'inherit',           boxShadow: '0 4px 12px var(--coral-soft)',
          }}>Delete</button>
        </div>
      </div>
    </div>
    </Portal>
  );
}

export default function RoutinePlanner({ store, setActiveTab }) {
  const {
    routines, toggleRoutine, isRoutineDone,
    addRoutine, updateRoutine, deleteRoutine, todayKey,
  } = store;

  const [mounted, setMounted] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [editingRoutine, setEditingRoutine] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [selectedDateIdx, setSelectedDateIdx] = useState(2);
  const [completingId, setCompletingId] = useState(null);

  useEffect(() => { const t = setTimeout(() => setMounted(true), 80); return () => clearTimeout(t); }, []);

  const anyOverlayOpen = showAdd || !!editingRoutine || !!deleteTarget;
  useEffect(() => {
    const el = document.getElementById('app-content-scroll');
    if (!el) return;
    el.style.overflowY = anyOverlayOpen ? 'hidden' : 'auto';
    return () => { el.style.overflowY = 'auto'; };
  }, [anyOverlayOpen]);

  const dayDates = useMemo(() => get5DayDates(), [todayKey]);

  const selectedDate = dayDates[selectedDateIdx];
  const todayDate = dayDates[2];

  const dateKey = selectedDate?.dateKey || toLocalDateKey(new Date());
  const now = new Date();

  const dayRoutines = useMemo(() => {
    if (!selectedDate) return [];
    return routines
      .filter(r => r.days.includes(selectedDate.dayOfWeek))
      .sort((a, b) => a.time.localeCompare(b.time));
  }, [routines, selectedDate]);

  const activeRoutines = useMemo(() => dayRoutines.filter(r => !isRoutineDone(r.id, dateKey)), [dayRoutines, isRoutineDone, dateKey]);
  const completedRoutines = useMemo(() => dayRoutines.filter(r => isRoutineDone(r.id, dateKey)), [dayRoutines, isRoutineDone, dateKey]);

  const doneCount = completedRoutines.length;
  const totalCount = dayRoutines.length;
  const pct = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0;

  const todayRoutines = useMemo(() => routines.filter(r => r.days.includes(todayDate?.dayOfWeek)), [routines, todayDate]);
  const nextRoutine = useMemo(() => getNextRoutine(todayRoutines, (id, dk) => isRoutineDone(id, dk || todayDate?.dateKey || dateKey), todayDate?.dateKey), [todayRoutines, isRoutineDone, todayDate, dateKey]);

  const animStyle = (delay = 0) => ({
    opacity: mounted ? 1 : 0,
    transform: mounted ? 'none' : 'translateY(12px)',
    transition: `all 0.5s cubic-bezier(0.16,1,0.3,1) ${delay}s`,
  });

  const handleSaveEdit = (updates) => {
    updateRoutine(editingRoutine.id, { ...updates, color: CAT_COLORS[updates.category] });
    setEditingRoutine(null);
  };

  const handleToggle = (id) => {
    setCompletingId(id);
    setTimeout(() => {
      toggleRoutine(id, dateKey);
      setCompletingId(null);
    }, 250);
  };

  const handleDelete = () => {
    if (deleteTarget) {
      deleteRoutine(deleteTarget.id);
      setDeleteTarget(null);
    }
  };

  const monthYear = now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  const quote = QUOTES[now.getDate() % QUOTES.length];

  const RoutineCard = ({ routine, isCompleted, index }) => {
    const color = CAT_COLORS[routine.category] || routine.color || 'var(--accent)';
    const endTime = computeEndTime(routine.time, routine.duration);
    const isCompleting = completingId === routine.id;

    return (
      <div style={{
        background: isCompleted ? 'var(--surface2)' : 'var(--card)',
        borderRadius: 14,
        border: `1px solid ${isCompleted ? 'var(--border)' : 'var(--border-glass)'}`,
        borderLeft: `3px solid ${isCompleted ? 'var(--green)' : color}`,
        boxShadow: isCompleted ? 'none' : 'var(--shadow-card)',
        padding: '10px 12px 10px 14px',
        opacity: isCompleted ? 0.55 : isCompleting ? 0.4 : 1,
        transform: isCompleting ? 'scale(0.96)' : 'scale(1)',
        transition: 'all 0.35s cubic-bezier(0.34,1.56,0.64,1)',
        animation: mounted ? `slideUpFade 0.4s cubic-bezier(0.16,1,0.3,1) ${index * 0.05}s both` : 'none',
        animationPlayState: mounted ? 'running' : 'paused',
        position: 'relative',
        overflow: 'hidden',
      }}>
        {isCompleted && (
          <div style={{
            position: 'absolute', top: 0, right: 0,
            width: 64, height: 64,
          }}>
            <div style={{
              position: 'absolute', top: 8, right: -20,
              width: 60, height: 18,
              transform: 'rotate(45deg)',
              background: 'var(--green)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 9, fontWeight: 800, color: '#fff',
              letterSpacing: '0.05em', paddingRight: 6,
              boxShadow: '0 2px 8px rgba(82,183,136,0.3)',
            }}>DONE</div>
          </div>
        )}

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 32, height: 32, borderRadius: 10,
            background: isCompleted ? 'var(--green-soft)' : color + '14',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0, color: isCompleted ? 'var(--green)' : color,
            transition: 'all 0.3s',
          }}>
            {isCompleted ? (
              <svg viewBox="0 0 16 16" fill="none" width="14" height="14">
                <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.8"/>
                <polyline points="4.5,8 6.5,10 11.5,5.5" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            ) : (
              <div style={{ fontSize: 14 }}>{CAT_ICONS[routine.category]?.()}</div>
            )}
          </div>

          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              fontSize: 13, fontWeight: 800,
              color: isCompleted ? 'var(--text-muted)' : 'var(--text)',
              textDecoration: isCompleted ? 'line-through' : 'none',
              fontFamily: "'Outfit', sans-serif",
              letterSpacing: '-0.2px',
              marginBottom: 3,
            }}>
              {routine.title}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              <span style={{
                fontSize: 10, fontWeight: 600, color: 'var(--text2)',
                fontFamily: "'DM Mono', monospace",
                display: 'flex', alignItems: 'center', gap: 2,
              }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" width="9" height="9">
                  <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
                </svg>
                {formatTime(routine.time)}–{formatTime(endTime)}
              </span>
              {routine.duration && (
                <span style={{
                  fontSize: 10, fontWeight: 600, color: 'var(--text-muted)',
                }}>
                  · {routine.duration}min
                </span>
              )}
              <span style={{
                fontSize: 9, fontWeight: 700, color,
                background: color + '14',
                padding: '2px 8px', borderRadius: 5,
                letterSpacing: '0.02em',
              }}>
                {routine.category}
              </span>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
            <button onClick={() => setEditingRoutine(routine)} style={{
              width: 26, height: 26, borderRadius: 8,
              background: 'transparent', border: 'none',
              cursor: 'pointer', display: 'flex', alignItems: 'center',
              justifyContent: 'center', color: 'var(--text-muted)',
              opacity: isCompleted ? 0.3 : 1,
            }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" width="10" height="10">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
              </svg>
            </button>
            {!isCompleted && (
              <button onClick={() => setDeleteTarget(routine)} style={{
                width: 26, height: 26, borderRadius: 8,
                background: 'transparent', border: 'none',
                cursor: 'pointer', display: 'flex', alignItems: 'center',
                justifyContent: 'center', color: 'var(--text-muted)',
              }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" width="10" height="10">
                  <polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                </svg>
              </button>
            )}
            <button onClick={() => handleToggle(routine.id)} style={{
              width: 26, height: 26, borderRadius: 8,
              background: isCompleted ? 'var(--green-soft)' : 'transparent',
              border: `1.5px solid ${isCompleted ? 'var(--green)' : 'var(--border)'}`,
              cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'all 0.2s',
            }}>
              {isCompleted ? (
                <svg viewBox="0 0 12 12" fill="none" width="8" height="8">
                  <polyline points="2,6 5,9 10,3" stroke="var(--green)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              ) : null}
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div style={{
      padding: '20px 0 20px',
      display: 'flex', flexDirection: 'column', gap: 0,
      position: 'relative', minHeight: '100%',
    }}>

      {/* ── Header ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '0 18px', marginBottom: 18, ...animStyle(0) }}>
        <button onClick={() => setActiveTab('gym')} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, display: 'flex', alignItems: 'center' }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--text)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5" /><path d="M12 19l-7-7 7-7" />
          </svg>
        </button>
        <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)' }}>Daily Planner</span>
      </div>

      {/* ── 5-Date Selector ── */}
      <div style={{ padding: '0 18px 20px', ...animStyle(0.03) }}>
        <div style={{
          display: 'flex', gap: 8,
          justifyContent: 'center',
        }}>
          {dayDates.map((d, i) => {
            const isSelected = selectedDateIdx === i;
            const isToday = d.isToday;
            const isPastNonToday = d.isPast && !isToday;

            return (
              <button key={i} onClick={() => setSelectedDateIdx(i)} style={{
                flex: 1, maxWidth: 72,
                padding: '12px 4px 10px',
                borderRadius: 16,
                cursor: 'pointer',
                background: isSelected
                  ? 'linear-gradient(145deg, var(--accent), var(--accent2))'
                  : 'var(--card)',
                border: isSelected
                  ? '1px solid rgba(255,255,255,0.1)'
                  : isToday
                    ? '1.5px solid var(--accent)'
                    : '1px solid var(--border)',
                boxShadow: isSelected
                  ? '0 6px 24px var(--accent-soft)'
                  : 'var(--shadow-sm)',
                transform: isSelected ? 'scale(1.05)' : 'scale(1)',
                transition: 'all 0.3s cubic-bezier(0.34,1.56,0.64,1)',
                textAlign: 'center',
                opacity: isPastNonToday && !isSelected ? 0.4 : 1,
                filter: isPastNonToday && !isSelected ? 'grayscale(0.5)' : 'none',
              }}>
                <div style={{
                  fontSize: 10, fontWeight: 700,
                  color: isSelected ? 'rgba(255,255,255,0.7)' : isToday ? 'var(--accent)' : 'var(--text-muted)',
                  letterSpacing: '0.02em', marginBottom: 2,
                }}>
                  {d.dayName}
                </div>
                <div style={{
                  fontSize: 20, fontWeight: 900,
                  color: isSelected ? '#fff' : 'var(--text)',
                  fontFamily: "'Outfit', sans-serif",
                  lineHeight: 1.1, marginBottom: 2,
                }}>
                  {d.dayNum}
                </div>
                <div style={{
                  fontSize: 8, fontWeight: 600, textTransform: 'uppercase',
                  color: isSelected ? 'rgba(255,255,255,0.5)' : 'var(--text-muted)',
                  letterSpacing: '0.04em',
                }}>
                  {d.month}
                </div>
                {isToday && (
                  <div style={{
                    fontSize: 7, fontWeight: 800, color: isSelected ? '#fff' : 'var(--accent)',
                    letterSpacing: '0.06em', marginTop: 3,
                    textTransform: 'uppercase',
                  }}>
                    Today
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Today's Progress ── */}
      <div style={{ padding: '0 18px', marginBottom: 16, ...animStyle(0.06) }}>
        <div style={{
          background: 'var(--surface)',
          borderRadius: 18,
          border: '1px solid var(--border-glass)',
          padding: '16px 18px',
          boxShadow: 'var(--shadow-card)',
        }}>
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            marginBottom: 10,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{
                width: 8, height: 8, borderRadius: '50%',
                background: pct === 100 ? 'var(--green)' : 'var(--accent)',
              }} />
              <span style={{
                fontSize: 13, fontWeight: 800, color: 'var(--text)',
                fontFamily: "'Outfit', sans-serif",
              }}>
                Today's Progress
              </span>
            </div>
            <div style={{
              fontSize: 14, fontWeight: 900, color: pct === 100 ? 'var(--green)' : 'var(--accent)',
              fontFamily: "'Outfit', sans-serif",
            }}>
              {doneCount}/{totalCount}
              <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)' }}>
                {' '}done
              </span>
            </div>
          </div>

          <div style={{
            height: 6, background: 'var(--border)', borderRadius: 99,
            overflow: 'hidden', position: 'relative',
          }}>
            <div style={{
              height: '100%', width: mounted ? `${pct}%` : '0%',
              background: `linear-gradient(90deg, var(--accent), var(--green))`,
              borderRadius: 99,
              transition: 'width 0.8s cubic-bezier(0.34,1.56,0.64,1)',
              position: 'relative',
            }}>
              <div style={{
                position: 'absolute', right: 0, top: 0,
                width: 6, height: 6, borderRadius: '50%',
                background: '#fff', opacity: 0.6,
              }} />
            </div>
          </div>

          <div style={{
            display: 'flex', justifyContent: 'space-between', marginTop: 4,
            fontSize: 9, color: 'var(--text-muted)', fontWeight: 600,
          }}>
            <span>0%</span>
            <span style={{ color: pct >= 50 ? 'var(--accent)' : 'var(--text-muted)' }}>50%</span>
            <span style={{ color: pct >= 100 ? 'var(--green)' : 'var(--text-muted)' }}>100%</span>
          </div>
        </div>
      </div>

      {/* ── Next Routine Widget ── */}
      {nextRoutine && selectedDate?.isToday && (
        <div style={{ padding: '0 18px', marginBottom: 16, ...animStyle(0.08) }}>
          <div style={{
            background: 'linear-gradient(135deg, var(--accent-soft), transparent)',
            borderRadius: 18,
            border: '1px solid var(--accent-soft)',
            padding: '14px 18px',
            display: 'flex', alignItems: 'center', gap: 14,
          }}>
            <div style={{
              width: 38, height: 38, borderRadius: 12,
              background: 'var(--accent)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0, color: '#fff',
              animation: 'ringPulse 2s infinite',
            }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" width="18" height="18">
                <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
              </svg>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                fontSize: 10, fontWeight: 700, color: 'var(--accent)',
                letterSpacing: '0.06em', marginBottom: 2, textTransform: 'uppercase',
              }}>
                Next Routine
              </div>
              <div style={{
                fontSize: 15, fontWeight: 800, color: 'var(--text)',
                fontFamily: "'Outfit', sans-serif",
              }}>
                {nextRoutine.title}
              </div>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 10, marginTop: 3,
                fontSize: 12, color: 'var(--text2)', fontWeight: 500,
              }}>
                <span>{formatTime(nextRoutine.time)}</span>
                {(() => {
                  const remaining = getTimeRemaining(nextRoutine.time);
                  return remaining ? (
                    <span style={{
                      background: 'var(--accent-soft)', color: 'var(--accent)',
                      fontWeight: 700, fontSize: 11, padding: '2px 10px',
                      borderRadius: 6,
                    }}>
                      in {remaining}
                    </span>
                  ) : (
                    <span style={{ color: 'var(--text-muted)' }}>starting now</span>
                  );
                })()}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Active Routines Section ── */}
      <div style={{ padding: '0 18px', ...animStyle(0.10) }}>
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          marginBottom: 12,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <h2 style={{
              fontSize: 16, fontWeight: 800, color: 'var(--text)', margin: 0,
              fontFamily: "'Outfit', sans-serif",
            }}>
              {selectedDate?.isToday ? "Today's Routines" : `${selectedDate?.dayName}'s Routines`}
            </h2>
            <span style={{
              fontSize: 10, fontWeight: 700, color: 'var(--accent)',
              background: 'var(--accent-soft)', padding: '2px 10px', borderRadius: 8,
            }}>
              {totalCount}
            </span>
          </div>
          <button onClick={() => setShowAdd(true)} style={{
            width: 32, height: 32, borderRadius: 10, border: 'none',
            background: 'var(--accent-soft)', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'var(--accent)', fontSize: 18, fontWeight: 300, lineHeight: 1,
            fontFamily: 'inherit',
            transition: 'all 0.2s',
          }}>+</button>
        </div>

        {dayRoutines.length === 0 ? (
          <div style={{
            padding: '36px 24px', textAlign: 'center',
            background: 'var(--glass)', borderRadius: 20,
            border: '1.5px dashed var(--border)',
            marginBottom: 16,
          }}>
            <div onClick={() => setShowAdd(true)} style={{
              width: 52, height: 52, borderRadius: 16,
              background: 'var(--accent-soft)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 14px', cursor: 'pointer',
              transition: 'background 0.2s',
            }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" width="24" height="24">
                <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
              </svg>
            </div>
            <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)', marginBottom: 6, fontFamily: "'Outfit', sans-serif" }}>
              No routines for {selectedDate?.dayName || 'today'}
            </div>
          </div>
        ) : (
          <>
            {/* Active Routines */}
            {activeRoutines.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: activeRoutines.length > 0 ? 20 : 0 }}>
                {activeRoutines.map((r, idx) => (
                  <RoutineCard key={r.id} routine={r} isCompleted={false} index={idx} />
                ))}
              </div>
            )}

            {/* Completed Section */}
            {completedRoutines.length > 0 && (
              <>
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  marginBottom: 10, paddingTop: 2,
                }}>
                  <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
                  <span style={{
                    fontSize: 11, fontWeight: 700, color: 'var(--green)',
                    letterSpacing: '0.04em', display: 'flex', alignItems: 'center', gap: 5,
                  }}>
                    <svg viewBox="0 0 12 12" fill="none" width="11" height="11">
                      <polyline points="2,6 5,9 10,3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    Completed ({completedRoutines.length})
                  </span>
                  <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {completedRoutines.map((r, idx) => (
                    <RoutineCard key={r.id} routine={r} isCompleted={true} index={idx} />
                  ))}
                </div>
              </>
            )}

            {/* Mark all complete notice */}
            {totalCount > 0 && doneCount === totalCount && (
              <div style={{
                textAlign: 'center', padding: '14px 0 4px',
                fontSize: 13, fontWeight: 700, color: 'var(--green)',
                fontFamily: "'Outfit', sans-serif",
                animation: mounted ? 'fadeUp 0.5s ease' : 'none',
              }}>
                <span style={{ marginRight: 6 }}>🎉</span>
                All routines done for {selectedDate?.isToday ? 'today' : selectedDate?.dayName}!
              </div>
            )}
          </>
        )}
      </div>

      {/* ── Modals ── */}
      <RoutineModal
        open={showAdd}
        onClose={() => setShowAdd(false)}
        onSave={(data) => addRoutine({ ...data, color: CAT_COLORS[data.category] })}
      />
      {editingRoutine && (
        <RoutineModal
          open={!!editingRoutine}
          onClose={() => setEditingRoutine(null)}
          onSave={handleSaveEdit}
          initial={editingRoutine}
        />
      )}
      <ConfirmDeleteModal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title={deleteTarget?.title || ''}
      />
    </div>
  );
}
