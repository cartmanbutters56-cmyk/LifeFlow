import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { GlassCard, ProgressRing } from '../components/UI';
import { getTodayKey } from '../data/sessionService';

const QUOTES = [
  '"Every day is a fresh start."',
  '"Small progress is still progress."',
  '"You are exactly where you need to be."',
  '"Be stronger than your excuses."',
  '"Your habits shape your future."',
  '"One day or day one. You decide."',
];

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  if (h < 21) return 'Good evening';
  return 'Good night';
}

function getWeekDays() {
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const today = new Date();
  const dow = today.getDay();
  const monday = new Date(today);
  monday.setDate(today.getDate() - (dow === 0 ? 6 : dow - 1));
  const todayStr = today.toDateString();
  return days.map((name, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return {
      dayName: name,
      dayNum: d.getDate(),
      dateKey: `${y}-${m}-${day}`,
      isToday: d.toDateString() === todayStr,
    };
  });
}

export default function Dashboard({ store, user }) {
  const {
    todayProgress, todayRoutines, todayRoutinesDone,
    getTodayMeals, todayWater, waterGoal,
    setActiveTab, isRoutineDone, toggleRoutine, todayKey,
    calorieGoal, waterUnit, profileName,
  } = store;

  const [mounted, setMounted] = useState(false);
  const [checkAnimId, setCheckAnimId] = useState(null);

  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 60);
    return () => clearTimeout(t);
  }, []);

  const greeting = getGreeting();
  const meals = getTodayMeals();
  const mealsDone = meals.length;
  const name = profileName || user?.displayName || '';
  const firebasePhoto = user?.photoURL || '';
  const todayStr = new Date().toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric',
  });
  const quote = QUOTES[new Date().getDate() % QUOTES.length];

  const weekDays = useMemo(() => getWeekDays(), []);

  const consumedCal = meals.filter(m => m.calories).reduce((s, m) => s + m.calories, 0);
  const calPct = calorieGoal > 0 ? Math.min(Math.round((consumedCal / calorieGoal) * 100), 100) : 0;
  const waterPct = waterGoal > 0 ? Math.min(Math.round((todayWater / waterGoal) * 100), 100) : 0;
  const score = todayProgress;

  const displayIntake = waterUnit === 'cups' ? Math.round(todayWater / 8) : waterUnit === 'ml' ? Math.round(todayWater * 29.5735) : todayWater;
  const displayGoal = waterUnit === 'cups' ? Math.round(waterGoal / 8) : waterUnit === 'ml' ? Math.round(waterGoal * 29.5735) : waterGoal;
  const unitLabel = waterUnit === 'cups' ? 'cups' : waterUnit === 'ml' ? 'ml' : 'oz';

  const sortedRoutines = useMemo(() => {
    const incomplete = [];
    const complete = [];
    todayRoutines.forEach(r => {
      if (isRoutineDone(r.id, todayKey)) {
        complete.push(r);
      } else {
        incomplete.push(r);
      }
    });
    incomplete.sort((a, b) => (a.time || '').localeCompare(b.time || ''));
    complete.sort((a, b) => (a.time || '').localeCompare(b.time || ''));
    return [...incomplete, ...complete];
  }, [todayRoutines, isRoutineDone, todayKey]);

  const handleToggle = useCallback((id) => {
    toggleRoutine(id, todayKey);
    setCheckAnimId(id);
    setTimeout(() => setCheckAnimId(null), 400);
  }, [toggleRoutine, todayKey]);

  const initials = name
    ? name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
    : '';

  const animState = mounted ? 'running' : 'paused';

  return (
    <div style={{
      paddingBottom: 20, minHeight: '100%',
      background: 'var(--bg-gradient)',
    }}>
      {/* ─── GREETING HEADER ─── */}
      <div style={{
        padding: '52px 22px 24px',
        background: 'var(--header-gradient)',
        borderBottomLeftRadius: 32,
        borderBottomRightRadius: 32,
        position: 'relative', overflow: 'hidden',
        animation: mounted ? 'heroEnter 0.5s cubic-bezier(0.16,1,0.3,1) both' : 'none',
        boxShadow: '0 10px 40px rgba(99,102,241,0.20)',
      }}>
        <div style={{
          position: 'absolute', top: -60, right: -30, width: 220, height: 220,
          borderRadius: '50%', background: 'rgba(255,255,255,0.15)',
          pointerEvents: 'none',
        }} />
        <div style={{
          position: 'absolute', bottom: -50, left: -40, width: 180, height: 180,
          borderRadius: '50%', background: 'rgba(255,255,255,0.10)',
          pointerEvents: 'none',
        }} />

        <div style={{ position: 'relative', zIndex: 1 }}>
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
            marginBottom: 8,
          }}>
            <div style={{ flex: 1 }}>
              <div style={{
                fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.75)',
                letterSpacing: '0.08em', marginBottom: 4, textTransform: 'uppercase',
              }}>
                {todayStr}
              </div>
              <h1 style={{
                fontSize: 28, fontWeight: 800, color: '#FFFFFF', margin: 0,
                letterSpacing: '-0.5px', lineHeight: 1.2,
              }}>
                {greeting}{name ? `, ${name}` : ''}
              </h1>
            </div>

            <div style={{
              width: 48, height: 48, borderRadius: '50%',
              background: initials ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.15)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0, marginLeft: 12,
              boxShadow: '0 4px 16px rgba(0,0,0,0.15)',
              backdropFilter: 'blur(10px)',
              border: '2px solid rgba(255,255,255,0.30)',
              overflow: 'hidden',
            }}>
              {firebasePhoto ? (
                <img src={firebasePhoto} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} referrerPolicy="no-referrer" />
              ) : initials ? (
                <span style={{ fontSize: 16, fontWeight: 800, color: '#FFFFFF' }}>
                  {initials}
                </span>
              ) : (
                <svg viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" width="20" height="20">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                  <circle cx="12" cy="7" r="4"/>
                </svg>
              )}
            </div>
          </div>

          <p style={{
            fontSize: 13, color: 'rgba(255,255,255,0.85)', fontStyle: 'italic',
            marginTop: 8, maxWidth: 280, lineHeight: 1.45,
            fontWeight: 500,
          }}>
            {quote}
          </p>
        </div>
      </div>

      {/* ─── WEEKLY CALENDAR ─── */}
      <div style={{
        padding: '18px 22px 0',
        animation: `slideUpFade 0.45s cubic-bezier(0.16,1,0.3,1) 0.05s both`,
        animationPlayState: animState,
      }}>
        <div style={{
          display: 'flex', justifyContent: 'space-between',
          paddingBottom: 4,
        }}>
          {weekDays.map((d) => (
            <div
              key={d.dateKey}
              style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center',
                gap: 6, flex: 1,
              }}
            >
              <span style={{
                fontSize: 11, fontWeight: 700,
                color: d.isToday ? 'var(--accent)' : 'var(--text-muted)',
                letterSpacing: '0.03em', textTransform: 'uppercase',
              }}>
                {d.dayName}
              </span>
              <div style={{
                width: 36, height: 36, borderRadius: 12,
                background: d.isToday
                  ? 'linear-gradient(145deg, var(--accent), var(--accent2))'
                  : 'var(--glass)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: d.isToday
                  ? '0 2px 12px var(--accent-soft)'
                  : 'none',
                transition: 'all 0.2s ease',
              }}>
                <span style={{
                  fontSize: 16, fontWeight: 900,
                  color: d.isToday ? '#fff' : 'var(--text)', lineHeight: 1,
                }}>
                  {d.dayNum}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ─── HEALTH METRICS ─── */}
      <div style={{
        padding: '18px 22px 0',
        animation: `slideUpFade 0.45s cubic-bezier(0.16,1,0.3,1) 0.10s both`,
        animationPlayState: animState,
      }}>
        <div style={{ display: 'flex', gap: 10, marginBottom: 10 }}>

          {/* ── CALORIES CARD ── */}
          <GlassCard style={{
            flex: 1, padding: '16px 14px 14px', borderRadius: 22,
            background: 'var(--card-gradient)',
            border: '1px solid var(--accent-soft)',
            boxShadow: '0 4px 20px var(--accent-soft)',
            display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
            minHeight: 118,
          }}>
            {/* Top: icon + label */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{
                width: 30, height: 30, borderRadius: 9,
                background: 'var(--accent-soft)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 15, flexShrink: 0,
              }}>
                🔥
              </div>
              <span style={{
                fontSize: 13, fontWeight: 700,
                color: 'var(--text)', letterSpacing: '-0.1px',
              }}>
                Calories
              </span>
            </div>

            {/* Bottom: number left, ring right */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 12 }}>
              <div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 500, marginBottom: 2 }}>
                  kcal
                </div>
                <div style={{
                  fontSize: 28, fontWeight: 800,
                  color: 'var(--text)', letterSpacing: '-1.5px', lineHeight: 1,
                }}>
                  {consumedCal.toLocaleString()}
                </div>
              </div>
              {/* Arc ring — no label inside */}
              <svg width="52" height="52" style={{ transform: 'rotate(-90deg)', display: 'block', flexShrink: 0 }}>
                {(() => {
                  const size = 52, stroke = 5, r = (size - stroke) / 2;
                  const circ = 2 * Math.PI * r;
                  const dash = circ - (Math.min(calPct, 100) / 100) * circ;
                  return (
                    <>
                      <circle cx="26" cy="26" r={r} fill="none" stroke="var(--accent-soft)" strokeWidth={stroke} />
                      <circle
                        cx="26" cy="26" r={r}
                        fill="none" stroke="var(--accent)" strokeWidth={stroke}
                        strokeDasharray={circ}
                        strokeDashoffset={mounted ? dash : circ}
                        strokeLinecap="round"
                        style={{ transition: 'stroke-dashoffset 1.1s cubic-bezier(0.34,1.2,0.64,1) 0.25s' }}
                      />
                    </>
                  );
                })()}
              </svg>
            </div>
          </GlassCard>

          {/* ── WATER CARD ── */}
          <GlassCard style={{
            flex: 1, padding: '16px 14px 14px', borderRadius: 22,
            background: 'var(--card-gradient)',
            border: '1px solid var(--water-soft)',
            boxShadow: '0 4px 20px var(--water-soft)',
            display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
            minHeight: 118,
          }}>
            {/* Top: icon + label */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{
                width: 30, height: 30, borderRadius: 9,
                background: 'var(--water-soft)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 15, flexShrink: 0,
              }}>
                💧
              </div>
              <span style={{
                fontSize: 13, fontWeight: 700,
                color: 'var(--text)', letterSpacing: '-0.1px',
              }}>
                Water
              </span>
            </div>

            {/* Bottom: number left, ring right */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 12 }}>
              <div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 500, marginBottom: 2 }}>
                  {unitLabel}
                </div>
                <div style={{
                  fontSize: 28, fontWeight: 800,
                  color: 'var(--text)', letterSpacing: '-1.5px', lineHeight: 1,
                }}>
                  {displayIntake.toLocaleString()}
                </div>
              </div>
              {/* Arc ring — no label inside */}
              <svg width="52" height="52" style={{ transform: 'rotate(-90deg)', display: 'block', flexShrink: 0 }}>
                {(() => {
                  const size = 52, stroke = 5, r = (size - stroke) / 2;
                  const circ = 2 * Math.PI * r;
                  const dash = circ - (Math.min(waterPct, 100) / 100) * circ;
                  return (
                    <>
                      <circle cx="26" cy="26" r={r} fill="none" stroke="var(--water-soft)" strokeWidth={stroke} />
                      <circle
                        cx="26" cy="26" r={r}
                        fill="none" stroke="var(--water)" strokeWidth={stroke}
                        strokeDasharray={circ}
                        strokeDashoffset={mounted ? dash : circ}
                        strokeLinecap="round"
                        style={{ transition: 'stroke-dashoffset 1.1s cubic-bezier(0.34,1.2,0.64,1) 0.32s' }}
                      />
                    </>
                  );
                })()}
              </svg>
            </div>
          </GlassCard>

        </div>

        <GlassCard style={{
          padding: 18, borderRadius: 24,
          background: 'var(--card-gradient)',
          border: '1px solid var(--accent-soft)',
          boxShadow: '0 6px 28px var(--accent-soft)',
          position: 'relative', overflow: 'hidden',
        }}>
          <div style={{
            position: 'absolute', top: -20, right: -20, width: 120, height: 120,
            borderRadius: '50%', background: 'var(--accent-soft)',
            pointerEvents: 'none',
          }} />
          <div style={{
            position: 'relative', zIndex: 1,
            display: 'flex', alignItems: 'center', gap: 20,
          }}>
            <ProgressRing
              pct={score}
              size={80}
              stroke={6}
              color="var(--accent)"
              bg="var(--accent-soft)"
              label={`${score}%`}
            />
            <div style={{ flex: 1 }}>
              <div style={{
                fontSize: 11, fontWeight: 600, color: 'var(--text-muted)',
                letterSpacing: '0.06em', marginBottom: 2,
              }}>
                DAILY WELLNESS
              </div>
              <div style={{
                fontSize: 17, fontWeight: 800, color: 'var(--text)',
              }}>
                {score === 0 ? 'Start your day' :
                 score < 30 ? 'Building momentum' :
                 score < 60 ? 'Getting there' :
                 score < 85 ? 'Great progress' :
                 score < 100 ? 'Almost perfect' :
                 'Perfect day!'}
              </div>
              <div style={{
                marginTop: 6, height: 4,
                background: 'var(--accent-soft)',
                borderRadius: 99, overflow: 'hidden',
              }}>
                <div style={{
                  height: '100%', width: mounted ? `${score}%` : '0%',
                  background: 'linear-gradient(90deg, var(--accent), var(--accent2))',
                  borderRadius: 99,
                  transition: 'width 1s cubic-bezier(0.34,1.56,0.64,1) 0.4s',
                }} />
              </div>
            </div>
          </div>
        </GlassCard>
      </div>

      {/* ─── TODAY'S ROUTINES ─── */}
      <div style={{
        padding: '22px 22px 0',
        animation: `slideUpFade 0.45s cubic-bezier(0.16,1,0.3,1) 0.15s both`,
        animationPlayState: animState,
      }}>
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          marginBottom: 10,
        }}>
          <h2 style={{
            fontSize: 17, fontWeight: 800, color: 'var(--text)', margin: 0,
            letterSpacing: '-0.3px',
          }}>
            Today's Routines
          </h2>
          <span style={{
            fontSize: 12, fontWeight: 700, color: 'var(--text-muted)',
            background: 'var(--pill-bg)',
            padding: '3px 10px', borderRadius: 99,
          }}>
            {todayRoutinesDone}/{todayRoutines.length}
          </span>
        </div>

        {todayRoutines.length === 0 ? (
          <div style={{
            padding: '32px 20px', textAlign: 'center',
            background: 'var(--glass-bg)',
            borderRadius: 22, border: '1px dashed var(--border)',
          }}>
            <div style={{ fontSize: 28, marginBottom: 8 }}>🔁</div>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>
              No routines for today
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 500 }}>
              Set up routines in the Routines tab
            </div>
          </div>
        ) : (
          <div style={{
            background: 'var(--glass-bg)',
            backdropFilter: 'blur(12px)',
            borderRadius: 22,
            border: '1px solid var(--border-glass)',
            boxShadow: 'var(--shadow-card)',
            overflow: 'hidden',
          }}>
            {sortedRoutines.map((r, i) => {
              const done = isRoutineDone(r.id, todayKey);
              const isLast = i === sortedRoutines.length - 1;
              const isChecking = checkAnimId === r.id;
              return (
                <div
                  key={r.id}
                  onClick={() => handleToggle(r.id)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    padding: '13px 16px',
                    borderBottom: isLast ? 'none' : '1px solid var(--divider)',
                    cursor: 'pointer',
                    transition: 'background 0.15s ease',
                    background: isChecking
                      ? 'var(--accent-soft)'
                      : 'transparent',
                  }}
                >
                  <div
                    onClick={(e) => { e.stopPropagation(); handleToggle(r.id); }}
                    style={{
                      width: 24, height: 24, borderRadius: 7,
                      border: `2px solid ${done ? 'var(--accent)' : 'var(--border2)'}`,
                      background: done ? 'var(--accent)' : 'transparent',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      flexShrink: 0, cursor: 'pointer',
                      transform: isChecking ? 'scale(1.25)' : 'scale(1)',
                      transition: 'all 0.25s cubic-bezier(0.34,1.56,0.64,1)',
                      boxShadow: done ? '0 0 0 3px var(--accent-soft)' : 'none',
                    }}
                  >
                    {done && (
                      <svg width="13" height="13" viewBox="0 0 12 12" fill="none">
                        <polyline points="2,6 5,9 10,3" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontSize: 14, fontWeight: 700, color: done ? 'var(--text-muted)' : 'var(--text)',
                      textDecoration: done ? 'line-through' : 'none',
                      transition: 'color 0.25s ease',
                      letterSpacing: '-0.2px',
                    }}>
                      {r.title}
                    </div>
                    <div style={{ display: 'flex', gap: 6, marginTop: 3, alignItems: 'center' }}>
                      {r.category && (
                        <span style={{
                          fontSize: 10, fontWeight: 700, color: 'var(--accent)',
                          background: 'var(--accent-soft)',
                          padding: '1px 7px', borderRadius: 99,
                          letterSpacing: '0.02em',
                        }}>
                          {r.category}
                        </span>
                      )}
                      {r.time && (
                        <span style={{
                          fontSize: 11, fontWeight: 500, color: 'var(--text-muted)',
                        }}>
                          {r.time}
                        </span>
                      )}
                    </div>
                  </div>

                  {done ? (
                    <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--green)' }}>
                      Done
                    </span>
                  ) : (
                    <svg viewBox="0 0 24 24" fill="none" stroke="var(--border2)" strokeWidth="2" strokeLinecap="round" width="14" height="14">
                      <polyline points="9 18 15 12 9 6"/>
                    </svg>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}