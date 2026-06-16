import React, { useState, useEffect, useMemo } from 'react';
import { CAT_META, ScheduleCard, ShareModal, ConfirmDeleteModal } from './RoutinePlanner';

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Morning';
  if (h < 17) return 'Afternoon';
  if (h < 21) return 'Evening';
  return 'Night';
}

function getWeekDays() {
  const today = new Date();
  const todayStr = today.toDateString();
  const dayNames = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
  return [-3, -2, -1, 0, 1, 2, 3].map(offset => {
    const d = new Date(today);
    d.setDate(today.getDate() + offset);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return {
      dayName: dayNames[d.getDay()],
      dayNum: d.getDate(),
      dateKey: `${y}-${m}-${day}`,
      isToday: d.toDateString() === todayStr,
      isPast: d < today && d.toDateString() !== todayStr,
    };
  });
}

/* ── Mini Arc SVG ── */
function ArcRing({ pct, size = 40, stroke = 4, color, trackColor, mounted }) {
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const dash = circ - (Math.min(pct, 100) / 100) * circ;
  return (
    <svg
      width={size}
      height={size}
      style={{ transform: 'rotate(-90deg)', display: 'block', flexShrink: 0 }}
    >
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={trackColor} strokeWidth={stroke} />
      <circle
        cx={size / 2} cy={size / 2} r={r}
        fill="none" stroke={color} strokeWidth={stroke}
        strokeDasharray={circ}
        strokeDashoffset={mounted ? dash : circ}
        strokeLinecap="round"
        style={{ transition: 'stroke-dashoffset 1.1s cubic-bezier(0.34,1.2,0.64,1) 0.25s' }}
      />
    </svg>
  );
}

/* ── Section Header Bar ── */
function SectionBar({ title, right }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{
          width: 3, height: 18, borderRadius: 2,
          background: 'linear-gradient(180deg, var(--accent), var(--accent2))',
        }} />
        <span style={{ fontSize: 15, fontWeight: 800, color: 'var(--text)', letterSpacing: '-0.3px' }}>
          {title}
        </span>
      </div>
      {right}
    </div>
  );
}

export default function Dashboard({ store, user }) {
  const {
    todayProgress,
    getTodayMeals, todayWater, waterGoal,
    setActiveTab, todayKey,
    calorieGoal, waterUnit, profileName,
    routines: allRoutines = [], updateRoutine, deleteRoutine,
  } = store;

  const events = allRoutines.filter(r => r.dateKey);

  const [mounted, setMounted] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [shareEvent, setShareEvent] = useState(null);
  const [activeGroupMenu, setActiveGroupMenu] = useState(null);
  const [scheduleOpen, setScheduleOpen] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 60);
    return () => clearTimeout(t);
  }, []);

  const greeting = getGreeting();
  const meals = getTodayMeals();
  const name = profileName || user?.displayName || '';
  const firebasePhoto = user?.photoURL || '';

  const dayLabel = new Date().toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric',
  });

  const weekDays = useMemo(() => getWeekDays(), []);

  const consumedCal = meals.filter(m => m.calories).reduce((s, m) => s + m.calories, 0);
  const calPct = calorieGoal > 0 ? Math.min(Math.round((consumedCal / calorieGoal) * 100), 100) : 0;
  const waterPct = waterGoal > 0 ? Math.min(Math.round((todayWater / waterGoal) * 100), 100) : 0;
  const score = todayProgress;

  const displayIntake = waterUnit === 'cups' ? Math.round(todayWater / 8)
    : waterUnit === 'ml' ? Math.round(todayWater * 29.5735) : todayWater;
  const displayGoal = waterUnit === 'cups' ? Math.round(waterGoal / 8)
    : waterUnit === 'ml' ? Math.round(waterGoal * 29.5735) : waterGoal;
  const unitLabel = waterUnit === 'cups' ? 'cups' : waterUnit === 'ml' ? 'ml' : 'oz';

  const upcomingEvents = useMemo(() => {
    return [...events]
      .filter(ev => ev.dateKey >= todayKey)
      .sort((a, b) => {
        if (a.dateKey !== b.dateKey) return (a.dateKey || '').localeCompare(b.dateKey || '');
        return (a.time || '').localeCompare(b.time || '');
      });
  }, [events, todayKey]);

  const upcomingGroups = useMemo(() => {
    const map2 = {};
    upcomingEvents.forEach(ev => {
      if (!map2[ev.dateKey]) map2[ev.dateKey] = [];
      map2[ev.dateKey].push(ev);
    });
    return Object.entries(map2).sort(([a], [b]) => a.localeCompare(b));
  }, [upcomingEvents]);

  const toggleReminder = (id) => {
    const ev = events.find(e => e.id === id);
    if (ev) updateRoutine(id, { reminder: !ev.reminder });
  };
  const handleDelete = () => {
    if (deleteTarget) { deleteRoutine(deleteTarget.id); setDeleteTarget(null); }
  };

  const initials = name
    ? name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
    : '';

  const scoreCopy = score === 0 ? 'Start your day'
    : score < 30 ? 'Building momentum'
    : score < 60 ? 'Getting there'
    : score < 85 ? 'Great progress'
    : score < 100 ? 'Almost perfect'
    : 'Perfect day!';

  const fadeUp = (delay) => ({
    opacity: mounted ? 1 : 0,
    transform: mounted ? 'translateY(0)' : 'translateY(12px)',
    transition: `opacity 0.42s ease ${delay}s, transform 0.42s cubic-bezier(0.16,1,0.3,1) ${delay}s`,
  });

  return (
    <div style={{ paddingBottom: 28, minHeight: '100%', background: 'var(--bg-gradient)' }}>

      {/* ═══ HEADER ═══ */}
      <div style={{
        padding: '52px 22px 20px',
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        gap: 12,
      }}>
        <div>
          <div style={{
            fontSize: 11, fontWeight: 700, color: 'var(--text-muted)',
            letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 3,
          }}>
            {dayLabel}
          </div>
          <h1 style={{
            fontSize: 26, fontWeight: 900, color: 'var(--text)',
            margin: 0, letterSpacing: '-0.5px', lineHeight: 1.1,
          }}>
            {greeting}
            {name ? (
              <>, <span style={{ color: 'var(--accent)' }}>{name.split(' ')[0]}</span></>
            ) : ''}
          </h1>
        </div>

        {/* Avatar */}
        <div
          onClick={() => setActiveTab?.('profile')}
          style={{
            width: 44, height: 44, borderRadius: '50%', flexShrink: 0,
            background: 'var(--accent-soft)',
            border: '2.5px solid var(--accent)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            overflow: 'hidden', cursor: 'pointer',
          }}
        >
          {firebasePhoto ? (
            <img
              src={firebasePhoto} alt=""
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              referrerPolicy="no-referrer"
            />
          ) : initials ? (
            <span style={{ fontSize: 15, fontWeight: 800, color: 'var(--accent)' }}>{initials}</span>
          ) : (
            <svg viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2"
              strokeLinecap="round" width="18" height="18">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
          )}
        </div>
      </div>

      {/* ═══ WEEK STRIP ═══ */}
      <div style={{ padding: '0 22px 20px', ...fadeUp(0.05) }}>
        <div style={{ display: 'flex', gap: 4 }}>
          {weekDays.map((d) => (
            <div key={d.dateKey} style={{
              flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5,
            }}>
              <span style={{
                fontSize: 10, fontWeight: 700,
                color: d.isToday ? 'var(--accent)' : 'var(--text-muted)',
                letterSpacing: '0.04em', textTransform: 'uppercase',
              }}>
                {d.dayName}
              </span>
              <div style={{
                width: 34, height: 34, borderRadius: 10,
                background: d.isToday
                  ? 'linear-gradient(145deg, var(--accent), var(--accent2))'
                  : d.isPast
                  ? 'transparent'
                  : 'var(--surface)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                border: d.isToday
                  ? 'none'
                  : d.isPast
                  ? '1.5px dashed var(--border)'
                  : '1.5px solid var(--border)',
                boxShadow: d.isToday ? '0 3px 12px var(--accent-soft)' : 'none',
              }}>
                <span style={{
                  fontSize: 14, fontWeight: d.isToday ? 900 : 600,
                  color: d.isToday ? '#fff' : d.isPast ? 'var(--text-muted)' : 'var(--text)',
                  lineHeight: 1,
                  opacity: d.isPast ? 0.45 : 1,
                }}>
                  {d.dayNum}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ═══ HERO WELLNESS RING ═══ */}
      <div style={{
        margin: '0 22px 16px',
        borderRadius: 28,
        background: 'linear-gradient(145deg, var(--accent), var(--accent2))',
        padding: '22px 20px',
        display: 'flex',
        alignItems: 'center',
        gap: 20,
        position: 'relative',
        overflow: 'hidden',
        boxShadow: '0 12px 40px var(--accent-soft)',
        ...fadeUp(0.1),
      }}>
        {/* Decorative blobs */}
        <div style={{
          position: 'absolute', top: -40, right: -20, width: 160, height: 160,
          borderRadius: '50%', background: 'rgba(255,255,255,0.1)', pointerEvents: 'none',
        }} />
        <div style={{
          position: 'absolute', bottom: -30, left: 60, width: 100, height: 100,
          borderRadius: '50%', background: 'rgba(255,255,255,0.06)', pointerEvents: 'none',
        }} />

        {/* Big progress ring */}
        <div style={{ position: 'relative', flexShrink: 0 }}>
          <svg width={96} height={96} style={{ transform: 'rotate(-90deg)' }}>
            {(() => {
              const size = 96, stroke = 8, r = (size - stroke) / 2;
              const circ = 2 * Math.PI * r;
              const dash = circ - (Math.min(score, 100) / 100) * circ;
              return (
                <>
                  <circle cx={48} cy={48} r={r} fill="none"
                    stroke="rgba(255,255,255,0.2)" strokeWidth={stroke} />
                  <circle cx={48} cy={48} r={r} fill="none"
                    stroke="rgba(255,255,255,0.95)" strokeWidth={stroke}
                    strokeDasharray={circ}
                    strokeDashoffset={mounted ? dash : circ}
                    strokeLinecap="round"
                    style={{ transition: 'stroke-dashoffset 1.2s cubic-bezier(0.34,1.2,0.64,1) 0.3s' }}
                  />
                </>
              );
            })()}
          </svg>
          <div style={{
            position: 'absolute', inset: 0,
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
          }}>
            <span style={{
              fontSize: 22, fontWeight: 900, color: '#fff',
              lineHeight: 1, letterSpacing: '-1px',
            }}>
              {score}%
            </span>
          </div>
        </div>

        {/* Text */}
        <div style={{ flex: 1, position: 'relative', zIndex: 1 }}>
          <div style={{
            fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.7)',
            letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 4,
          }}>
            Daily Wellness
          </div>
          <div style={{
            fontSize: 20, fontWeight: 900, color: '#fff',
            letterSpacing: '-0.4px', lineHeight: 1.15, marginBottom: 10,
          }}>
            {scoreCopy}
          </div>

          {/* Progress bar */}
          <div style={{
            height: 3, background: 'rgba(255,255,255,0.2)',
            borderRadius: 99, overflow: 'hidden',
          }}>
            <div style={{
              height: '100%',
              width: mounted ? `${score}%` : '0%',
              background: '#fff',
              borderRadius: 99,
              transition: 'width 1.1s cubic-bezier(0.34,1.56,0.64,1) 0.45s',
            }} />
          </div>
        </div>
      </div>

      {/* ═══ METRICS ROW ═══ */}
      <div style={{
        padding: '0 22px',
        display: 'flex',
        gap: 10,
        marginBottom: 16,
        ...fadeUp(0.18),
      }}>
        {/* Calories */}
        <div
          onClick={() => setActiveTab?.('meals')}
          style={{
            flex: 1, padding: '14px 13px', borderRadius: 22,
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            boxShadow: 'var(--shadow-card)',
            cursor: 'pointer',
            display: 'flex', flexDirection: 'column', gap: 9,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{
                width: 26, height: 26, borderRadius: 8,
                background: 'rgba(217,107,109,0.12)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13,
              }}>🔥</div>
              <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text)' }}>Calories</span>
            </div>
            <ArcRing
              pct={calPct} size={36} stroke={3.5}
              color="var(--coral)"
              trackColor="rgba(217,107,109,0.12)"
              mounted={mounted}
            />
          </div>
          <div>
            <div style={{
              fontSize: 22, fontWeight: 900, color: 'var(--text)',
              letterSpacing: '-1px', lineHeight: 1,
            }}>
              {consumedCal.toLocaleString()}
            </div>
            <div style={{ fontSize: 9, fontWeight: 600, color: 'var(--text-muted)', marginTop: 2 }}>
              of {calorieGoal.toLocaleString()} kcal · {calPct}%
            </div>
          </div>
        </div>

        {/* Water */}
        <div
          onClick={() => setActiveTab?.('water')}
          style={{
            flex: 1, padding: '14px 13px', borderRadius: 22,
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            boxShadow: 'var(--shadow-card)',
            cursor: 'pointer',
            display: 'flex', flexDirection: 'column', gap: 9,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{
                width: 26, height: 26, borderRadius: 8,
                background: 'var(--water-soft)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13,
              }}>💧</div>
              <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text)' }}>Water</span>
            </div>
            <ArcRing
              pct={waterPct} size={36} stroke={3.5}
              color="var(--water)"
              trackColor="var(--water-soft)"
              mounted={mounted}
            />
          </div>
          <div>
            <div style={{
              fontSize: 22, fontWeight: 900, color: 'var(--text)',
              letterSpacing: '-1px', lineHeight: 1,
            }}>
              {displayIntake.toLocaleString()}
            </div>
            <div style={{ fontSize: 9, fontWeight: 600, color: 'var(--text-muted)', marginTop: 2 }}>
              of {displayGoal} {unitLabel} · {waterPct}%
            </div>
          </div>
        </div>
      </div>

      {/* ═══ ACTIVITY HUB 2×2 ═══ */}
      <div style={{ padding: '0 22px', marginBottom: 16, ...fadeUp(0.24) }}>
        <SectionBar title="Activity Hub" />

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 9 }}>
          {[
            {
              tab: 'routines',
              label: 'Routine Planner',
              emoji: '📅',
              gradient: 'linear-gradient(145deg, #6B62C8, #9B8FF5)',
              desc: 'Daily habits',
            },
            {
              tab: 'meals',
              label: 'Meal Planner',
              emoji: '🍽️',
              gradient: 'linear-gradient(145deg, #C45A5C, #E88080)',
              desc: 'Track nutrition',
            },
            {
              tab: 'water',
              label: 'Water Tracker',
              emoji: '💧',
              gradient: 'linear-gradient(145deg, #2E7EC4, #5AAAE0)',
              desc: 'Stay hydrated',
            },
          ].map((card) => (
            <button
              key={card.tab}
              onClick={() => setActiveTab?.(card.tab)}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'flex-start',
                justifyContent: 'space-between',
                /* Smaller cards than before */
                padding: '13px 12px 12px',
                borderRadius: 18,
                background: card.gradient,
                border: 'none',
                cursor: 'pointer',
                fontFamily: 'inherit',
                textAlign: 'left',
                aspectRatio: '1 / 1',
                boxSizing: 'border-box',
                transition: 'transform 0.16s cubic-bezier(0.34,1.56,0.64,1), box-shadow 0.16s ease',
                boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
                position: 'relative',
                overflow: 'hidden',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.transform = 'scale(1.035)';
                e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.2)';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.transform = 'scale(1)';
                e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.12)';
              }}
              onMouseDown={e => { e.currentTarget.style.transform = 'scale(0.96)'; }}
              onMouseUp={e => { e.currentTarget.style.transform = 'scale(1.035)'; }}
              onTouchStart={e => { e.currentTarget.style.transform = 'scale(0.96)'; }}
              onTouchEnd={e => { e.currentTarget.style.transform = 'scale(1)'; }}
            >
              {/* Decorative circle */}
              <div style={{
                position: 'absolute', top: -14, right: -14, width: 64, height: 64,
                borderRadius: '50%', background: 'rgba(255,255,255,0.1)', pointerEvents: 'none',
              }} />

              {/* Emoji icon */}
              <div style={{
                width: 36, height: 36, borderRadius: 11,
                background: 'rgba(0,0,0,0.18)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 17,
              }}>
                {card.emoji}
              </div>

              {/* Label */}
              <div style={{ paddingTop: 10 }}>
                <div style={{
                  fontSize: 12, fontWeight: 800, color: '#fff',
                  lineHeight: 1.2, letterSpacing: '-0.1px',
                }}>
                  {card.label}
                </div>
                <div style={{
                  fontSize: 9, fontWeight: 600,
                  color: 'rgba(255,255,255,0.65)', marginTop: 2,
                }}>
                  {card.desc}
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* ═══ UPCOMING SCHEDULE ═══ */}
      <div style={{ padding: '0 22px', ...fadeUp(0.36) }}>
        <button
          onClick={() => setScheduleOpen(o => !o)}
          style={{
            display: 'flex', alignItems: 'center', gap: 8,
            width: '100%', background: 'none', border: 'none', cursor: 'pointer',
            padding: '8px 0', fontFamily: 'inherit',
            marginBottom: scheduleOpen ? 12 : 0,
            transition: 'margin 0.3s ease',
          }}
        >
          <div style={{
            width: 3, height: 18, borderRadius: 2,
            background: 'linear-gradient(180deg, var(--accent), var(--accent2))',
            flexShrink: 0,
          }} />
          <span style={{
            fontSize: 15, fontWeight: 800, color: 'var(--text)',
            letterSpacing: '-0.3px', flex: 1, textAlign: 'left',
          }}>
            Upcoming Schedule
          </span>
          {upcomingGroups.length > 0 && (
            <span style={{
              fontSize: 10, fontWeight: 700, color: 'var(--accent)',
              background: 'var(--accent-soft)', padding: '3px 9px', borderRadius: 99,
            }}>
              {upcomingEvents.length}
            </span>
          )}
          <div style={{
            transition: 'transform 0.35s cubic-bezier(0.34,1.56,0.64,1)',
            transform: scheduleOpen ? 'rotate(180deg)' : 'rotate(0deg)',
            color: 'var(--text-muted)', display: 'flex',
          }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth="2.5" strokeLinecap="round" width="17" height="17">
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </div>
        </button>

        {/* Collapsible content */}
        <div style={{
          display: 'grid',
          gridTemplateRows: scheduleOpen ? '1fr' : '0fr',
          transition: 'grid-template-rows 0.4s cubic-bezier(0.16,1,0.3,1)',
        }}>
          <div style={{ overflow: 'hidden', minHeight: 0 }}>
            {upcomingGroups.length === 0 ? (
              <div style={{
                padding: '28px 20px', textAlign: 'center',
                background: 'var(--glass-bg)',
                borderRadius: 20,
                border: '1px dashed var(--border)',
              }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>
                  No upcoming events
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.5 }}>
                  Add events in the Schedule Planner tab
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                {upcomingGroups.map(([dateKey, evs]) => {
                  const dateObj = new Date(dateKey + 'T00:00:00');
                  const dayNum = dateObj.getDate();
                  const monthAbbr = dateObj.toLocaleDateString('en-US', { month: 'short' }).toUpperCase();
                  const weekday = dateObj.toLocaleDateString('en-US', { weekday: 'long' });
                  const isToday = dateKey === todayKey;

                  return (
                    <div key={dateKey}>
                      {/* Date row */}
                      <div style={{
                        display: 'flex', alignItems: 'center',
                        gap: 10, marginBottom: 10, padding: '0 2px',
                      }}>
                        <div style={{
                          width: 38, height: 38, borderRadius: 11,
                          background: isToday
                            ? 'linear-gradient(145deg, var(--accent), var(--accent2))'
                            : 'var(--surface)',
                          display: 'flex', flexDirection: 'column',
                          alignItems: 'center', justifyContent: 'center',
                          flexShrink: 0,
                          border: isToday ? 'none' : '1px solid var(--border)',
                          boxShadow: isToday ? '0 4px 14px var(--accent-soft)' : 'var(--shadow-sm)',
                        }}>
                          <span style={{
                            fontSize: 7.5, fontWeight: 800,
                            color: isToday ? 'rgba(255,255,255,0.8)' : 'var(--text-muted)',
                            letterSpacing: '0.04em', lineHeight: 1,
                          }}>{monthAbbr}</span>
                          <span style={{
                            fontSize: 15, fontWeight: 900,
                            color: isToday ? '#fff' : 'var(--text)', lineHeight: 1.2,
                          }}>{dayNum}</span>
                        </div>

                        <div style={{ flex: 1 }}>
                          <span style={{ fontSize: 14, fontWeight: 800, color: 'var(--text)' }}>
                            {isToday ? 'Today' : weekday}
                          </span>
                          {isToday && (
                            <span style={{
                              marginLeft: 8, fontSize: 9, fontWeight: 700,
                              color: 'var(--accent)',
                              background: 'var(--accent-soft)',
                              padding: '2px 7px', borderRadius: 99,
                            }}>NOW</span>
                          )}
                        </div>

                        {/* Group kebab menu */}
                        <div style={{ position: 'relative' }}>
                          <button
                            onClick={() => setActiveGroupMenu(
                              activeGroupMenu === dateKey ? null : dateKey
                            )}
                            style={{
                              background: 'none', border: 'none', cursor: 'pointer',
                              color: 'var(--text-muted)', fontSize: 17, fontWeight: 700,
                              padding: '2px 4px', lineHeight: 1,
                            }}
                          >⋯</button>
                          {activeGroupMenu === dateKey && (
                            <div
                              onClick={() => setActiveGroupMenu(null)}
                              style={{
                                position: 'absolute', right: 0, top: 26, zIndex: 50,
                                background: 'var(--card)', borderRadius: 14,
                                border: '1px solid var(--border)',
                                boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
                                minWidth: 170, overflow: 'hidden', padding: 4,
                              }}
                            >
                              {evs.map(ev => {
                                const m = CAT_META[ev.category] || CAT_META.Meeting;
                                return (
                                  <div
                                    key={ev.id}
                                    style={{
                                      display: 'flex', alignItems: 'center',
                                      gap: 8, padding: '8px 10px', borderRadius: 9,
                                    }}
                                  >
                                    <div style={{
                                      width: 6, height: 6, borderRadius: '50%',
                                      background: m.color, flexShrink: 0,
                                    }} />
                                    <span style={{
                                      fontSize: 12, fontWeight: 700, color: 'var(--text)',
                                      flex: 1, minWidth: 0,
                                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                                    }}>{ev.title}</span>
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setActiveGroupMenu(null);
                                        setDeleteTarget(ev);
                                      }}
                                      style={{
                                        background: 'none', border: 'none', cursor: 'pointer',
                                        color: 'var(--coral)', fontSize: 11, fontWeight: 600,
                                        padding: '2px 5px', fontFamily: 'inherit',
                                      }}
                                    >Del</button>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Event cards */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                        {evs.map(ev => (
                          <ScheduleCard
                            key={ev.id}
                            event={ev}
                            onEdit={() => {}}
                            onDelete={setDeleteTarget}
                            onToggleReminder={toggleReminder}
                            onShare={setShareEvent}
                          />
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Modals ── */}
      <ConfirmDeleteModal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title={deleteTarget?.title || ''}
      />
      <ShareModal
        open={!!shareEvent}
        onClose={() => setShareEvent(null)}
        event={shareEvent}
        userId={user?.uid}
        userName={user?.displayName || ''}
      />
    </div>
  );
}