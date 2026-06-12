import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Modal, inputStyle, Portal } from '../components/UI';

// ─── Constants ────────────────────────────────────────────────────────────────

const CATEGORIES = ['Meeting', 'Task', 'Birthday', 'Event', 'Reminder'];

const CAT_META = {
  Meeting: {
    color: '#7EC8A4',          // green
    dot: '#7EC8A4',
    bg: '#E8F7F0',
    icon: () => (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
        strokeLinecap="round" strokeLinejoin="round" width="22" height="22">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
        <circle cx="9" cy="7" r="4"/>
        <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
        <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
      </svg>
    ),
  },
  Task: {
    color: '#7B8FD4',          // purple/blue
    dot: '#7B8FD4',
    bg: '#EEF0FB',
    icon: () => (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
        strokeLinecap="round" strokeLinejoin="round" width="22" height="22">
        <path d="M9 11l3 3L22 4"/>
        <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
      </svg>
    ),
  },
  Birthday: {
    color: '#E07B7B',          // coral/red
    dot: '#E07B7B',
    bg: '#FCF0F0',
    icon: () => (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
        strokeLinecap="round" strokeLinejoin="round" width="22" height="22">
        <path d="M20 12v10H4V12"/>
        <path d="M2 7h20v5H2z"/>
        <path d="M12 22V7"/>
        <path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z"/>
        <path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z"/>
      </svg>
    ),
  },
  Event: {
    color: '#F5C842',          // yellow/gold
    dot: '#F5C842',
    bg: '#FDF8E3',
    icon: () => (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
        strokeLinecap="round" strokeLinejoin="round" width="22" height="22">
        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
      </svg>
    ),
  },
  Reminder: {
    color: '#F49E4C',          // orange
    dot: '#F49E4C',
    bg: '#FEF3E8',
    icon: () => (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
        strokeLinecap="round" strokeLinejoin="round" width="22" height="22">
        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
        <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
      </svg>
    ),
  },
};

const DAY_LABELS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

function toLocalDateKey(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

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
  const endH = Math.floor(totalMin / 60) % 24;
  const endM = totalMin % 60;
  return `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`;
}

// ─── Calendar Grid ─────────────────────────────────────────────────────────────

function buildCalendarDays(year, month) {
  const firstDay = new Date(year, month, 1).getDay(); // 0=Sun
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const prevDays = new Date(year, month, 0).getDate();
  const cells = [];

  for (let i = 0; i < firstDay; i++) {
    cells.push({ day: prevDays - firstDay + 1 + i, cur: false });
  }
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ day: d, cur: true });
  }
  const remaining = 42 - cells.length;
  for (let i = 1; i <= remaining; i++) {
    cells.push({ day: i, cur: false });
  }
  return cells;
}

// ─── Event/Add Modal ───────────────────────────────────────────────────────────

function EventModal({ open, onClose, onSave, initial, defaultCategory }) {
  const [title, setTitle] = useState(initial?.title || '');
  const [category, setCategory] = useState(initial?.category || defaultCategory || 'Meeting');
  const [time, setTime] = useState(initial?.time || '10:00');
  const [duration, setDuration] = useState(initial?.duration || 60);
  const [date, setDate] = useState(initial?.dateKey || toLocalDateKey(new Date()));
  const [reminder, setReminder] = useState(initial?.reminder || false);
  const [location, setLocation] = useState(initial?.location || '');

  useEffect(() => {
    if (open) {
      setTitle(initial?.title || '');
      setCategory(initial?.category || defaultCategory || 'Meeting');
      setTime(initial?.time || '10:00');
      setDuration(initial?.duration || 60);
      setDate(initial?.dateKey || toLocalDateKey(new Date()));
      setReminder(initial?.reminder || false);
      setLocation(initial?.location || '');
    }
  }, [open, initial, defaultCategory]);

  const submit = () => {
    if (!title.trim()) return;
    onSave({ title: title.trim(), category, time, duration: parseInt(duration) || 60, dateKey: date, reminder, location });
    onClose();
  };

  const meta = CAT_META[category];

  return (
    <Modal open={open} onClose={onClose} title={initial ? 'Edit Event' : 'New Event'}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

        {/* Category selector */}
        <div>
          <label style={labelStyle}>TYPE</label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
            {CATEGORIES.map(c => {
              const m = CAT_META[c];
              const active = category === c;
              return (
                <button key={c} onClick={() => setCategory(c)} style={{
                  padding: '6px 12px', borderRadius: 10, fontSize: 12, fontWeight: 600,
                  cursor: 'pointer', fontFamily: 'inherit',
                  border: `1.5px solid ${active ? m.color : 'var(--border)'}`,
                  background: active ? m.bg : 'transparent',
                  color: active ? m.color : 'var(--text-muted)',
                  display: 'flex', alignItems: 'center', gap: 5,
                  transition: 'all 0.15s',
                }}>
                  <span style={{ color: m.color, opacity: active ? 1 : 0.5 }}>{m.icon()}</span>
                  {c}
                </button>
              );
            })}
          </div>
        </div>

        {/* Title */}
        <div>
          <label style={labelStyle}>TITLE</label>
          <input style={inputStyle} placeholder="e.g. Team Standup" value={title} onChange={e => setTitle(e.target.value)} />
        </div>

        {/* Date + Time */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <div>
            <label style={labelStyle}>DATE</label>
            <input type="date" style={{ ...inputStyle }} value={date} onChange={e => setDate(e.target.value)} />
          </div>
          <div>
            <label style={labelStyle}>TIME</label>
            <input type="time" style={{ ...inputStyle }} value={time} onChange={e => setTime(e.target.value)} />
          </div>
        </div>

        {/* Duration + Location */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <div>
            <label style={labelStyle}>DURATION (min)</label>
            <input type="number" min="5" step="5" style={inputStyle} value={duration} onChange={e => setDuration(e.target.value)} />
          </div>
          <div>
            <label style={labelStyle}>LOCATION</label>
            <input style={inputStyle} placeholder="Optional" value={location} onChange={e => setLocation(e.target.value)} />
          </div>
        </div>

        {/* Reminder toggle */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>Set Reminder</span>
          <button onClick={() => setReminder(r => !r)} style={{
            width: 44, height: 24, borderRadius: 12,
            background: reminder ? meta.color : 'var(--border)',
            border: 'none', cursor: 'pointer', position: 'relative',
            transition: 'background 0.2s',
          }}>
            <span style={{
              position: 'absolute', top: 3, left: reminder ? 23 : 3,
              width: 18, height: 18, borderRadius: '50%', background: '#fff',
              transition: 'left 0.2s',
              boxShadow: '0 1px 4px rgba(0,0,0,0.2)',
            }} />
          </button>
        </div>

        <button onClick={submit} style={{
          marginTop: 4, padding: '13px 22px', borderRadius: 14,
          background: meta.color, border: 'none', color: '#fff',
          fontSize: 15, fontWeight: 700, cursor: 'pointer',
          fontFamily: 'inherit',
          boxShadow: `0 4px 16px ${meta.color}44`,
        }}>{initial ? 'Save Changes' : 'Add Event'}</button>
      </div>
    </Modal>
  );
}

const labelStyle = {
  fontSize: 11, fontWeight: 700, color: 'var(--text-muted)',
  letterSpacing: '0.06em', display: 'block', marginBottom: 7,
};

// ─── Delete Confirm ─────────────────────────────────────────────────────────────

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
          <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text)', fontFamily: "'Outfit', sans-serif", marginBottom: 8 }}>Delete Event</div>
          <div style={{ fontSize: 14, color: 'var(--text-muted)', marginBottom: 20, lineHeight: 1.5 }}>
            Delete <strong style={{ color: 'var(--text)' }}>"{title}"</strong>?
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={onClose} style={{
              flex: 1, padding: '11px', borderRadius: 12,
              border: '1.5px solid var(--border)', background: 'transparent',
              color: 'var(--text)', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
            }}>Cancel</button>
            <button onClick={onConfirm} style={{
              flex: 1, padding: '11px', borderRadius: 12,
              border: 'none', background: 'var(--coral)', color: '#fff',
              fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
              boxShadow: '0 4px 12px var(--coral-soft)',
            }}>Delete</button>
          </div>
        </div>
      </div>
    </Portal>
  );
}

// ─── Schedule Card ──────────────────────────────────────────────────────────────

function ScheduleCard({ event, onEdit, onDelete, onToggleReminder }) {
  const meta = CAT_META[event.category] || CAT_META.Meeting;
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div style={{
      background: 'var(--card)',
      borderRadius: 16,
      border: '1px solid var(--border-glass)',
      padding: '12px 14px',
      boxShadow: 'var(--shadow-card)',
      position: 'relative',
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
        {/* Col 1 – day-of-week dot */}
        <div style={{
          width: 36, height: 36, borderRadius: 12,
          background: meta.bg,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0, color: meta.color,
        }}>
          {meta.icon()}
        </div>

        {/* Col 2 – text */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: 13, fontWeight: 800, color: 'var(--text)',
            fontFamily: "'Outfit', sans-serif", marginBottom: 3,
          }}>{event.title}</div>
          <div style={{
            fontSize: 11, color: 'var(--text-muted)', fontWeight: 500,
            display: 'flex', alignItems: 'center', gap: 4,
          }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" width="10" height="10">
              <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
            </svg>
            {event.time ? formatTime(event.time) : '—'}
          </div>

          {/* Reminder row */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            marginTop: 10,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              {/* Avatars placeholder */}
              <div style={{ display: 'flex' }}>
                {[meta.color, meta.bg].map((c, i) => (
                  <div key={i} style={{
                    width: 22, height: 22, borderRadius: '50%',
                    background: c, border: '2px solid var(--card)',
                    marginLeft: i > 0 ? -6 : 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 9, fontWeight: 700, color: meta.color,
                  }} />
                ))}
                <div style={{
                  width: 22, height: 22, borderRadius: '50%',
                  background: 'var(--border)',
                  border: '2px solid var(--card)',
                  marginLeft: -6,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 9, fontWeight: 700, color: 'var(--text-muted)',
                }}>+</div>
              </div>
              <span style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 600 }}>Set Reminder</span>
              {/* Toggle */}
              <button onClick={() => onToggleReminder(event.id)} style={{
                width: 32, height: 17, borderRadius: 9,
                background: event.reminder ? meta.color : 'var(--border)',
                border: 'none', cursor: 'pointer', position: 'relative',
                transition: 'background 0.2s', flexShrink: 0,
              }}>
                <span style={{
                  position: 'absolute', top: 2, left: event.reminder ? 16 : 2,
                  width: 13, height: 13, borderRadius: '50%', background: '#fff',
                  transition: 'left 0.2s',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.25)',
                }} />
              </button>
            </div>
          </div>

          {/* Share / Reschedule */}
          <div style={{
            display: 'flex', gap: 12, marginTop: 8,
            fontSize: 10, color: 'var(--text-muted)', fontWeight: 600,
          }}>
            <button onClick={() => onEdit(event)} style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: 'var(--text-muted)', fontSize: 10, fontWeight: 600,
              fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 3,
              padding: 0,
            }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" width="10" height="10">
                <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/>
                <polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/>
              </svg>
              Share
            </button>
            <button onClick={() => onEdit(event)} style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: 'var(--text-muted)', fontSize: 10, fontWeight: 600,
              fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 3,
              padding: 0,
            }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" width="10" height="10">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                <line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/>
                <line x1="3" y1="10" x2="21" y2="10"/>
              </svg>
              Reschedule
            </button>
            {event.location && (
              <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" width="10" height="10">
                  <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
                  <circle cx="12" cy="10" r="3"/>
                </svg>
                {event.location}
              </span>
            )}
          </div>
        </div>

        {/* ⋯ menu */}
        <div style={{ position: 'relative' }}>
          <button onClick={() => setMenuOpen(o => !o)} style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: 'var(--text-muted)', padding: 4, lineHeight: 1,
            fontSize: 16, fontWeight: 700,
          }}>⋯</button>
          {menuOpen && (
            <div onClick={() => setMenuOpen(false)} style={{
              position: 'absolute', right: 0, top: 28, zIndex: 50,
              background: 'var(--card)', borderRadius: 12,
              border: '1px solid var(--border)',
              boxShadow: '0 8px 32px rgba(0,0,0,0.15)',
              minWidth: 110, overflow: 'hidden',
            }}>
              {[
                { label: 'Edit', action: () => onEdit(event) },
                { label: 'Delete', action: () => onDelete(event), danger: true },
              ].map(item => (
                <button key={item.label} onClick={item.action} style={{
                  display: 'block', width: '100%', textAlign: 'left',
                  padding: '10px 14px', border: 'none', background: 'transparent',
                  cursor: 'pointer', fontSize: 13, fontWeight: 600,
                  color: item.danger ? 'var(--coral)' : 'var(--text)',
                  fontFamily: 'inherit',
                }}>{item.label}</button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ─────────────────────────────────────────────────────────────

export default function RoutinePlanner({ store, setActiveTab }) {
  const { routines: all = [], addRoutine, updateRoutine, deleteRoutine, todayKey } = store;
  const events = all.filter(r => r.dateKey);

  // Treat "routines" as events with category-based fields
  const addEvent = (data) => addRoutine({ ...data });
  const updateEvent = (id, data) => updateRoutine(id, data);
  const deleteEvent = (id) => deleteRoutine(id);
  const toggleReminder = (id) => {
    const ev = events.find(e => e.id === id);
    if (ev) updateRoutine(id, { reminder: !ev.reminder });
  };

  const today = new Date();
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [selectedDateKey, setSelectedDateKey] = useState(toLocalDateKey(today));
  const [showAdd, setShowAdd] = useState(false);
  const [addCategory, setAddCategory] = useState('Meeting');
  const [editingEvent, setEditingEvent] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [createExpanded, setCreateExpanded] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => { const t = setTimeout(() => setMounted(true), 80); return () => clearTimeout(t); }, []);

  const anyOverlayOpen = showAdd || !!editingEvent || !!deleteTarget;
  useEffect(() => {
    const el = document.getElementById('app-content-scroll');
    if (!el) return;
    el.style.overflowY = anyOverlayOpen ? 'hidden' : 'auto';
    return () => { el.style.overflowY = 'auto'; };
  }, [anyOverlayOpen]);

  const calCells = useMemo(() => buildCalendarDays(viewYear, viewMonth), [viewYear, viewMonth]);

  const todayDateKey = toLocalDateKey(today);
  const monthName = new Date(viewYear, viewMonth, 1)
    .toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  // Events keyed by dateKey
  const eventsByDate = useMemo(() => {
    const map = {};
    events.forEach(ev => {
      if (!map[ev.dateKey]) map[ev.dateKey] = [];
      map[ev.dateKey].push(ev);
    });
    return map;
  }, [events]);

  // Upcoming events sorted by date then time (from today onwards)
  const upcomingEvents = useMemo(() => {
    return [...events]
      .filter(ev => ev.dateKey >= todayDateKey)
      .sort((a, b) => {
        if (a.dateKey !== b.dateKey) return a.dateKey.localeCompare(b.dateKey);
        return a.time.localeCompare(b.time);
      });
  }, [events, todayDateKey]);

  // Group upcoming by dateKey
  const upcomingGroups = useMemo(() => {
    const groups = [];
    const seen = {};
    upcomingEvents.forEach(ev => {
      if (!seen[ev.dateKey]) {
        seen[ev.dateKey] = true;
        groups.push({ dateKey: ev.dateKey, evs: [] });
      }
      groups[groups.length - 1].evs.push(ev);
    });
    // fix: rebuild properly
    const map2 = {};
    upcomingEvents.forEach(ev => {
      if (!map2[ev.dateKey]) map2[ev.dateKey] = [];
      map2[ev.dateKey].push(ev);
    });
    return Object.entries(map2).sort(([a], [b]) => a.localeCompare(b));
  }, [upcomingEvents]);

  function formatGroupDate(dateKey) {
    const d = new Date(dateKey + 'T00:00:00');
    return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  }
  function getDayLabel(dateKey) {
    const d = new Date(dateKey + 'T00:00:00');
    return d.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase();
  }

  const prevMonth = () => {
    if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11); }
    else setViewMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0); }
    else setViewMonth(m => m + 1);
  };

  const handleCategoryClick = (cat) => {
    setAddCategory(cat);
    setShowAdd(true);
    setCreateExpanded(false);
  };

  const handleDelete = () => {
    if (deleteTarget) { deleteEvent(deleteTarget.id); setDeleteTarget(null); }
  };

  return (
    <div style={{
      padding: '0 0 28px',
      display: 'flex', flexDirection: 'column', gap: 0,
      position: 'relative', minHeight: '100%',
      background: 'var(--bg)',
    }}>

      {/* ── Top bar ── */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '16px 18px 10px',
        opacity: mounted ? 1 : 0,
        transform: mounted ? 'none' : 'translateY(-8px)',
        transition: 'all 0.4s ease',
      }}>
        <button onClick={() => setActiveTab?.('gym')} style={{
          background: 'none', border: 'none', cursor: 'pointer',
          padding: 4, display: 'flex', alignItems: 'center',
        }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--text)"
            strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5"/><path d="M12 19l-7-7 7-7"/>
          </svg>
        </button>
        <span style={{
          fontSize: 17, fontWeight: 800, color: 'var(--text)',
          fontFamily: "'Outfit', sans-serif",
        }}>My Calendar</span>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <div style={{
            width: 28, height: 28, borderRadius: '50%',
            background: 'var(--accent)', display: 'flex', alignItems: 'center',
            justifyContent: 'center', fontSize: 12, fontWeight: 800, color: '#fff',
          }}>{today.getDate()}</div>
        </div>
      </div>

      {/* ── Month nav ── */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 18px 12px',
        opacity: mounted ? 1 : 0,
        transition: 'all 0.4s ease 0.05s',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button onClick={prevMonth} style={navBtnStyle}>‹</button>
          <span style={{
            fontSize: 15, fontWeight: 800, color: 'var(--text)',
            fontFamily: "'Outfit', sans-serif",
          }}>{monthName}</span>
          <button onClick={nextMonth} style={navBtnStyle}>›</button>
        </div>
        <button onClick={() => {
          const t = new Date();
          setViewYear(t.getFullYear());
          setViewMonth(t.getMonth());
          setSelectedDateKey(toLocalDateKey(t));
        }} style={{
          padding: '5px 12px', borderRadius: 8, fontSize: 12, fontWeight: 700,
          background: 'var(--accent)', color: '#fff', border: 'none', cursor: 'pointer',
          fontFamily: 'inherit',
        }}>Today</button>
      </div>

      {/* ── Calendar Grid ── */}
      <div style={{
        padding: '0 18px',
        opacity: mounted ? 1 : 0,
        transition: 'all 0.4s ease 0.08s',
      }}>
        {/* Day headers */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', marginBottom: 6 }}>
          {DAY_LABELS.map(d => (
            <div key={d} style={{
              textAlign: 'center', fontSize: 10, fontWeight: 700,
              color: 'var(--text-muted)', padding: '0 0 4px',
              letterSpacing: '0.04em',
            }}>{d}</div>
          ))}
        </div>

        {/* Day cells */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '2px 0' }}>
          {calCells.map((cell, idx) => {
            const cellDateKey = cell.cur
              ? `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(cell.day).padStart(2, '0')}`
              : null;
            const isToday = cellDateKey === todayDateKey;
            const isSelected = cellDateKey === selectedDateKey;
            const cellEvents = cellDateKey ? (eventsByDate[cellDateKey] || []) : [];
            const catColor = cellEvents.length > 0 ? CAT_META[cellEvents[0].category]?.color : null;
            const catBg = cellEvents.length > 0 ? CAT_META[cellEvents[0].category]?.bg : null;

            return (
              <div
                key={idx}
                onClick={() => cell.cur && setSelectedDateKey(cellDateKey)}
                style={{
                  textAlign: 'center', padding: '6px 2px',
                  cursor: cell.cur ? 'pointer' : 'default',
                  borderRadius: 10,
                  position: 'relative',
                }}
              >
                <div style={{
                  width: 30, height: 30, borderRadius: '50%',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  margin: '0 auto',
                  background: isSelected
                    ? 'var(--accent)'
                    : cellEvents.length > 0 && !isToday
                      ? catBg
                      : 'transparent',
                  border: isToday && !isSelected
                    ? `2px solid ${cellEvents.length > 0 ? catColor : 'var(--accent)'}`
                    : cellEvents.length > 0 && !isSelected
                      ? `2px solid ${catColor}44`
                      : 'none',
                  fontSize: 13, fontWeight: isToday || isSelected ? 800 : 600,
                  color: isSelected
                    ? '#fff'
                    : !cell.cur
                      ? 'var(--border)'
                      : cellEvents.length > 0 && !isToday
                        ? catColor
                        : 'var(--text)',
                  transition: 'all 0.15s',
                }}>{cell.day}</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Create Schedule section ── */}
      <div style={{
        padding: '20px 18px 0',
        opacity: mounted ? 1 : 0,
        transition: 'all 0.4s ease 0.12s',
      }}>
        <div style={{
          fontSize: 15, fontWeight: 800, color: 'var(--text)',
          fontFamily: "'Outfit', sans-serif", marginBottom: 14,
        }}>Create Schedule</div>

        <div style={{
          display: 'flex', gap: 14, alignItems: 'center',
          overflowX: createExpanded ? 'auto' : 'visible',
        }}>
          {/* "Create" main button */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
            <button
              onClick={() => setCreateExpanded(e => !e)}
              style={{
                width: 56, height: 56, borderRadius: 18,
                background: createExpanded ? 'var(--accent)' : 'var(--surface)',
                border: `2px solid ${createExpanded ? 'var(--accent)' : 'var(--border)'}`,
                cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: createExpanded ? '#fff' : 'var(--text-muted)',
                transition: 'all 0.3s cubic-bezier(0.34,1.56,0.64,1)',
                boxShadow: createExpanded ? '0 6px 20px var(--accent-soft)' : 'var(--shadow-sm)',
                flexShrink: 0,
              }}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                strokeLinecap="round" width="22" height="22">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                <line x1="16" y1="2" x2="16" y2="6"/>
                <line x1="8" y1="2" x2="8" y2="6"/>
                <line x1="3" y1="10" x2="21" y2="10"/>
              </svg>
            </button>
            <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)' }}>Create</span>
          </div>

          {/* Category bubbles – slide in when expanded */}
          <div style={{
            display: 'flex', gap: 14, alignItems: 'center',
            overflow: 'hidden',
            maxWidth: createExpanded ? 400 : 0,
            opacity: createExpanded ? 1 : 0,
            transition: 'max-width 0.4s cubic-bezier(0.34,1.56,0.64,1), opacity 0.3s ease',
          }}>
            {CATEGORIES.map((cat, i) => {
              const meta = CAT_META[cat];
              return (
                <div
                  key={cat}
                  style={{
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
                    flexShrink: 0,
                    opacity: createExpanded ? 1 : 0,
                    transform: createExpanded ? 'scale(1)' : 'scale(0.7)',
                    transition: `all 0.35s cubic-bezier(0.34,1.56,0.64,1) ${i * 0.05}s`,
                  }}
                >
                  <button
                    onClick={() => handleCategoryClick(cat)}
                    style={{
                      width: 56, height: 56, borderRadius: 18,
                      background: meta.bg,
                      border: `2px solid ${meta.color}33`,
                      cursor: 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: meta.color,
                      transition: 'all 0.2s',
                      boxShadow: `0 4px 14px ${meta.color}22`,
                    }}
                  >
                    {meta.icon()}
                  </button>
                  <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                    {cat}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Upcoming Schedule ── */}
      <div style={{
        padding: '20px 18px 0',
        opacity: mounted ? 1 : 0,
        transition: 'all 0.4s ease 0.16s',
      }}>
        <div style={{
          fontSize: 15, fontWeight: 800, color: 'var(--text)',
          fontFamily: "'Outfit', sans-serif", marginBottom: 14,
        }}>Schedule</div>

        {upcomingGroups.length === 0 ? (
          <div style={{
            padding: '36px 24px', textAlign: 'center',
            background: 'var(--glass)', borderRadius: 20,
            border: '1.5px dashed var(--border)',
          }}>
            <button onClick={() => { setCreateExpanded(true); }} style={{
              width: 52, height: 52, borderRadius: 16,
              background: 'var(--accent-soft)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 14px', cursor: 'pointer', border: 'none',
            }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2"
                strokeLinecap="round" width="24" height="24">
                <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
              </svg>
            </button>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', marginBottom: 5, fontFamily: "'Outfit', sans-serif" }}>
              No upcoming events
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              Tap Create above to add your first event
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {upcomingGroups.map(([dateKey, evs]) => {
              const meta0 = CAT_META[evs[0]?.category] || CAT_META.Meeting;
              const dayLabel = getDayLabel(dateKey);
              const dateLabel = formatGroupDate(dateKey);

              return (
                <div key={dateKey}>
                  {/* Date header row */}
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10,
                  }}>
                    {/* Day circle */}
                    <div style={{
                      width: 40, height: 40, borderRadius: 12,
                      background: meta0.bg,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      flexShrink: 0, color: meta0.color,
                    }}>
                      {meta0.icon()}
                    </div>
                    <div>
                      <div style={{
                        fontSize: 13, fontWeight: 800, color: 'var(--text)',
                        fontFamily: "'Outfit', sans-serif",
                      }}>{dateLabel}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>{dayLabel}</div>
                    </div>
                    <div style={{ flex: 1 }} />
                    {/* ⋯ */}
                    <button style={{
                      background: 'none', border: 'none', cursor: 'pointer',
                      color: 'var(--text-muted)', fontSize: 18, fontWeight: 700, padding: 4,
                    }}>⋯</button>
                  </div>

                  {/* Event cards for this date */}
                  <div style={{
                    display: 'flex', flexDirection: 'column', gap: 10,
                    paddingLeft: 52, // indent under the icon
                    position: 'relative',
                  }}>
                    {/* Timeline line */}
                    {evs.length > 1 && (
                      <div style={{
                        position: 'absolute', left: 19, top: 0, bottom: 0,
                        width: 2, background: 'var(--border)',
                        borderRadius: 2,
                      }} />
                    )}
                    {evs.map(ev => (
                      <ScheduleCard
                        key={ev.id}
                        event={ev}
                        onEdit={setEditingEvent}
                        onDelete={setDeleteTarget}
                        onToggleReminder={toggleReminder}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Modals ── */}
      <EventModal
        open={showAdd}
        onClose={() => setShowAdd(false)}
        onSave={addEvent}
        defaultCategory={addCategory}
      />
      {editingEvent && (
        <EventModal
          open={!!editingEvent}
          onClose={() => setEditingEvent(null)}
          onSave={(data) => { updateEvent(editingEvent.id, data); setEditingEvent(null); }}
          initial={editingEvent}
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

const navBtnStyle = {
  background: 'none', border: 'none', cursor: 'pointer',
  fontSize: 20, fontWeight: 700, color: 'var(--text)',
  padding: '0 4px', lineHeight: 1, fontFamily: 'inherit',
};