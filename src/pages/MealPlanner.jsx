import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Portal } from '../components/UI';
import { FOODS, MEAL_SLOTS, SLOT_META } from './Fooddatabase';

function stringColor(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
  const colors = [
    '#FF6B6B','#FECA57','#48DBFB','#FF9FF3','#54A0FF',
    '#5F27CD','#1DD1A1','#00D2D3','#F368E0','#FF6348',
  ];
  return colors[Math.abs(hash) % colors.length];
}

const T = {
  bg:        'var(--bg)',
  card:      'var(--card)',
  dark:      'var(--card-dark)',
  accent:    'var(--accent)',
  accentSoft:'var(--accent-soft)',
  coral:     'var(--coral)',
  amber:     'var(--amber)',
  blue:      'var(--blue, #5B7FFF)',
  text:      'var(--text)',
  muted:     'var(--text-muted)',
  border:    'var(--border)',
  navBg:     'var(--nav-bg)',
  radius:    '18px',
  radiusSm:  '12px',
};

const SlotIcon = ({ slot, size = 16, color = 'currentColor' }) => {
  const s = { viewBox:'0 0 24 24', fill:'none', stroke:color, strokeWidth:'2',
              strokeLinecap:'round', strokeLinejoin:'round', width:size, height:size };
  if (slot === 'Breakfast') return (
    <svg {...s}><circle cx="12" cy="12" r="4"/>
      <line x1="12" y1="2" x2="12" y2="4"/><line x1="12" y1="20" x2="12" y2="22"/>
      <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
      <line x1="2" y1="12" x2="4" y2="12"/><line x1="20" y1="12" x2="22" y2="12"/>
      <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
    </svg>
  );
  if (slot === 'Lunch') return (
    <svg {...s}><path d="M3 11l19-9-9 19-2-8-8-2z"/></svg>
  );
  if (slot === 'Dinner') return (
    <svg {...s}><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
  );
  return (
    <svg {...s}>
      <path d="M17 8C8 10 5.9 16.17 3.82 19.82A1 1 0 0 0 4.64 21h14.72a1 1 0 0 0 .82-1.18C19.5 17 18 11 17 8z"/>
      <path d="M17 8c0-4-2-6-5-6s-5 2-5 6"/>
    </svg>
  );
};

function CalRing({ pct, size, stroke, trackColor, fillColor, children }) {
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const dash = Math.min(pct / 100, 1) * circ;
  return (
    <div style={{ position:'relative', width:size, height:size, flexShrink:0 }}>
      <svg width={size} height={size} style={{ transform:'rotate(-90deg)' }}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={trackColor} strokeWidth={stroke}/>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={fillColor} strokeWidth={stroke}
          strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
          style={{ transition:'stroke-dasharray 0.6s ease' }}/>
      </svg>
      <div style={{ position:'absolute', inset:0, display:'flex', flexDirection:'column',
                    alignItems:'center', justifyContent:'center' }}>
        {children}
      </div>
    </div>
  );
}

function BottomNav({ active, onSelect }) {
  const tabs = [
    {
      id: 'today',
      label: 'Today',
      icon: (on) => (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
          stroke={on ? T.accent : T.muted} strokeWidth="2" strokeLinecap="round">
          <rect x="3" y="4" width="18" height="17" rx="3"/>
          <line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/>
          <line x1="3" y1="10" x2="21" y2="10"/>
        </svg>
      ),
    },
    {
      id: 'progress',
      label: 'Progress',
      icon: (on) => (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
          stroke={on ? T.accent : T.muted} strokeWidth="2" strokeLinecap="round">
          <line x1="18" y1="20" x2="18" y2="10"/>
          <line x1="12" y1="20" x2="12" y2="4"/>
          <line x1="6"  y1="20" x2="6"  y2="14"/>
        </svg>
      ),
    },
    {
      id: 'mealplan',
      label: 'Meal Plan',
      icon: (on) => (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
          stroke={on ? T.accent : T.muted} strokeWidth="2" strokeLinecap="round">
          <path d="M3 11l19-9-9 19-2-8-8-2z" fill={on ? T.accent : 'none'}
            stroke={on ? T.accent : T.muted}/>
        </svg>
      ),
    },
  ];

  return (
    <div style={{
      position: 'sticky', bottom: 0,
      background: T.navBg,
      borderTop: `1px solid ${T.border}`,
      display: 'flex',
      paddingBottom: 'env(safe-area-inset-bottom, 8px)',
      zIndex: 50,
    }}>
      {tabs.map(tab => {
        const on = active === tab.id;
        return (
          <button key={tab.id} onClick={() => onSelect(tab.id)}
            style={{
              flex: 1, border: 'none', background: 'transparent',
              cursor: 'pointer', padding: '10px 0 6px',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
              fontFamily: 'inherit',
            }}>
            {tab.icon(on)}
            <span style={{
              fontSize: 11, fontWeight: on ? 700 : 500,
              color: on ? T.accent : T.muted,
              letterSpacing: '0.01em',
            }}>{tab.label}</span>
          </button>
        );
      })}
    </div>
  );
}

function PageHeader({ title, right }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '20px 20px 0',
    }}>
      <h1 style={{
        margin: 0, fontSize: 26, fontWeight: 800,
        color: T.text, letterSpacing: '-0.3px',
        fontFamily: "'Inter', 'Outfit', system-ui, sans-serif",
      }}>{title}</h1>
      {right}
    </div>
  );
}

function Avatar({ name, size = 40 }) {
  const color = stringColor(name || '?');
  const letter = (name?.[0] || '?').toUpperCase();
  return (
    <div style={{
      width: size, height: size, borderRadius: size / 3,
      background: color + '22', border: `1.5px solid ${color}44`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: size * 0.4, fontWeight: 800, color, flexShrink: 0,
    }}>{letter}</div>
  );
}

function toLocalDateKey(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function formatDate(d) {
  return d.toLocaleDateString('en', { month: 'short', day: 'numeric' });
}

// ── TODAY screen ──────────────────────────────────────────────────────────────
function TodayScreen({ meals, calorieGoal, proteinGoal, onGoals, mealsAll, timePeriod, accountCreatedAt }) {
  const totalCals    = meals.reduce((s, m) => s + (m.calories || 0), 0);
  const totalProtein = meals.reduce((s, m) => s + (m.protein  || 0), 0);
  const remaining    = Math.max(calorieGoal - totalCals, 0);
  const isOver       = totalCals > calorieGoal;
  const calPct       = calorieGoal > 0 ? Math.min((totalCals / calorieGoal) * 100, 100) : 0;
  const proteinPct   = proteinGoal > 0 ? Math.min((totalProtein / proteinGoal) * 100, 100) : 0;

  if (timePeriod === 'week') {
    return <WeekView mealsAll={mealsAll} calorieGoal={calorieGoal} proteinGoal={proteinGoal} accountCreatedAt={accountCreatedAt} />;
  }

  if (timePeriod === 'month') {
    return <MonthView mealsAll={mealsAll} calorieGoal={calorieGoal} proteinGoal={proteinGoal} accountCreatedAt={accountCreatedAt} />;
  }

  const bySlot = {};
  MEAL_SLOTS.forEach(s => { bySlot[s] = []; });
  meals.forEach(m => { const sl = m.slot || 'Breakfast'; if (bySlot[sl]) bySlot[sl].push(m); });
  const slotOrder = MEAL_SLOTS.filter(s => bySlot[s].length > 0);

  return (
    <div style={{ flex: 1, overflowY: 'auto' }}>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '20px 20px 0',
      }}>
        <div>
          <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: T.muted, letterSpacing: '0.05em' }}>
            TODAY
          </p>
          <h1 style={{
            margin: 0, fontSize: 26, fontWeight: 800, color: T.text,
            fontFamily: "'Inter', system-ui, sans-serif", letterSpacing: '-0.3px',
          }}>Dashboard</h1>
        </div>
        <button onClick={onGoals} style={{
          padding: '10px 18px', borderRadius: 9999,
          background: T.accent, border: 'none', cursor: 'pointer',
          display: 'flex', alignItems: 'center', gap: 6,
          color: '#fff', fontSize: 13, fontWeight: 700, fontFamily: 'inherit',
        }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
            stroke="#fff" strokeWidth="2.5" strokeLinecap="round">
            <circle cx="12" cy="12" r="3"/>
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
          </svg>
          Edit Goal
        </button>
      </div>

      <div style={{ padding: '16px 16px 24px' }}>

        <div style={{
          background: T.card, borderRadius: 24, padding: 0,
          marginBottom: 20, border: `1px solid ${T.border}`,
          overflow: 'hidden', boxShadow: 'var(--shadow-sm)',
        }}>
          <div style={{ height: 4, background: `linear-gradient(90deg, ${T.accent}, ${T.accent}88)` }}/>
          <div style={{ padding: '20px 22px 22px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
              <CalRing pct={calPct} size={110} stroke={9}
                trackColor="var(--border)" fillColor={T.accent}>
                <span style={{ fontSize: 24, fontWeight: 900, color: T.text, lineHeight: 1 }}>
                  {remaining.toFixed(1)}
                </span>
                <span style={{ fontSize: 11, color: T.muted, marginTop: 2 }}>
                  cal left
                </span>
              </CalRing>

              <div style={{ flex: 1 }}>
                <div style={{ marginBottom: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ fontSize: 12, color: T.muted, fontWeight: 500 }}>Calories</span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: T.text }}>{totalCals.toFixed(1)} / {calorieGoal}</span>
                  </div>
                  <div style={{ height: 4, background: T.border, borderRadius: 99 }}>
                    <div style={{
                      height: '100%', borderRadius: 99,
                      width: `${calPct}%`, background: T.coral,
                      transition: 'width 0.5s ease',
                    }}/>
                  </div>
                </div>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ fontSize: 12, color: T.muted, fontWeight: 500 }}>Protein</span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: T.text }}>{totalProtein.toFixed(1)}g / {proteinGoal}g</span>
                  </div>
                  <div style={{ height: 4, background: T.border, borderRadius: 99 }}>
                    <div style={{
                      height: '100%', borderRadius: 99,
                      width: `${proteinPct}%`, background: T.blue,
                      transition: 'width 0.5s ease',
                    }}/>
                  </div>
                </div>
              </div>
            </div>

            {isOver && (
              <div style={{
                marginTop: 12, padding: '8px 12px', borderRadius: 10,
                background: T.coral + '18', border: `1px solid ${T.coral}30`,
                fontSize: 12, fontWeight: 600, color: T.coral,
              }}>
                {(totalCals - calorieGoal).toFixed(1)} cal over your daily goal
              </div>
            )}
          </div>
        </div>

        {MEAL_SLOTS.map(slot => {
          const meta = SLOT_META[slot];
          const slotMeals = bySlot[slot];
          const slotCals  = slotMeals.reduce((s, m) => s + (m.calories || 0), 0);
          const slotProtein = slotMeals.reduce((s, m) => s + (m.protein || 0), 0);
          const hasItems = slotMeals.length > 0;
          const accent = meta.color || T.accent;
          return (
            <div key={slot} style={{
              background: hasItems ? accent + '18' : T.card,
              borderRadius: T.radius,
              border: `1px solid ${hasItems ? accent + '35' : T.border}`,
              marginBottom: 10, overflow: 'hidden',
              transition: 'all 0.2s',
            }}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 14,
                padding: '16px 18px',
              }}>
                <div style={{
                  width: 42, height: 42, borderRadius: 12,
                  background: hasItems ? accent + '18' : T.bg,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <SlotIcon slot={slot} size={19} color={hasItems ? accent : T.muted}/>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 15, fontWeight: 700, color: hasItems ? T.text : T.muted }}>
                    {slot}
                  </div>
                  <div style={{ fontSize: 12, color: T.muted, marginTop: 1 }}>{meta.time}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 18, fontWeight: 900, color: hasItems ? accent : T.muted, lineHeight: 1.2 }}>
                    {slotCals.toFixed(1)}
                  </div>
                  <div style={{ fontSize: 9, color: T.muted, textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: 1 }}>cal</div>
                </div>
                <div style={{
                  width: 1, height: 32, background: T.border, flexShrink: 0,
                }}/>
                <div style={{ textAlign: 'right', minWidth: 48 }}>
                  <div style={{ fontSize: 18, fontWeight: 900, color: hasItems ? T.blue : T.muted, lineHeight: 1.2 }}>
                    {slotProtein.toFixed(1)}
                  </div>
                  <div style={{ fontSize: 9, color: T.muted, textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: 1 }}>protein</div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── WEEK view ─────────────────────────────────────────────────────────────────
function WeekView({ mealsAll, calorieGoal, proteinGoal, accountCreatedAt }) {
  const today = new Date();
  const start = new Date(accountCreatedAt + 'T00:00:00');
  const totalDays = Math.max(0, Math.floor((today - start) / (1000 * 60 * 60 * 24)) + 1);

  const days = [];
  for (let i = 0; i < totalDays; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    const key = toLocalDateKey(d);
    const dayMeals = mealsAll[key] || [];
    const nowStr = toLocalDateKey(today);
    days.push({
      key,
      label: d.toLocaleDateString('en', { weekday: 'long' }),
      date: formatDate(d),
      isToday: key === nowStr,
      cals: dayMeals.reduce((s, m) => s + (m.calories || 0), 0),
      protein: dayMeals.reduce((s, m) => s + (m.protein || 0), 0),
    });
  }

  const weekCals = days.reduce((s, d) => s + d.cals, 0);
  const weekProtein = days.reduce((s, d) => s + d.protein, 0);

  return (
    <div style={{ flex: 1, overflowY: 'auto' }}>
      <PageHeader title="This Week" />

      <div style={{ padding: '16px 16px 24px' }}>
        <div style={{
          background: T.card, borderRadius: 20, padding: 0,
          marginBottom: 18, border: `1px solid ${T.border}`,
          overflow: 'hidden', boxShadow: 'var(--shadow-sm)',
        }}>
          <div style={{ height: 3, background: `linear-gradient(90deg, ${T.accent}, ${T.blue})` }}/>
          <div style={{ padding: '18px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: 12, color: T.muted, fontWeight: 600, letterSpacing: '0.05em' }}>TOTAL</div>
              <div style={{ fontSize: 28, fontWeight: 900, color: T.text, marginTop: 2 }}>{weekCals.toFixed(1)}</div>
              <div style={{ fontSize: 12, color: T.muted, marginTop: 1 }}>calories · {totalDays} days</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 12, color: T.muted, fontWeight: 600, letterSpacing: '0.05em' }}>PROTEIN</div>
              <div style={{ fontSize: 28, fontWeight: 900, color: T.blue, marginTop: 2 }}>{weekProtein.toFixed(1)}g</div>
              <div style={{ fontSize: 12, color: T.muted, marginTop: 1 }}>total</div>
            </div>
          </div>
        </div>

        {days.slice().reverse().map((day, i) => {
          const calBar = calorieGoal > 0 ? Math.min((day.cals / calorieGoal) * 100, 100) : 0;
          const proBar = proteinGoal > 0 ? Math.min((day.protein / proteinGoal) * 100, 100) : 0;
          return (
            <div key={day.key} style={{
              background: T.card, borderRadius: T.radiusSm,
              border: `1px solid ${day.isToday ? T.accent : T.border}`,
              marginBottom: 8, padding: '14px 16px',
              boxShadow: day.isToday ? `0 0 0 1px ${T.accent}40` : 'none',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{
                    fontSize: 14, fontWeight: 700, color: T.text,
                  }}>{day.label}</span>
                  <span style={{ fontSize: 11, fontWeight: 500, color: T.muted }}>{day.date}</span>
                  {day.isToday && (
                    <span style={{
                      fontSize: 9, fontWeight: 800, color: '#fff',
                      background: T.accent, padding: '2px 7px', borderRadius: 99,
                      textTransform: 'uppercase', letterSpacing: '0.04em',
                    }}>Today</span>
                  )}
                </div>
                <div style={{ textAlign: 'right' }}>
                  <span style={{ fontSize: 15, fontWeight: 800, color: T.text }}>{day.cals.toFixed(1)}</span>
                  <span style={{ fontSize: 11, color: T.muted, marginLeft: 2 }}>cal</span>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <div style={{
                    height: 4, background: T.border, borderRadius: 99, overflow: 'hidden',
                  }}>
                    <div style={{
                      height: '100%', borderRadius: 99, width: `${calBar}%`,
                      background: day.cals > calorieGoal ? T.coral : T.accent,
                      transition: 'width 0.5s ease',
                    }}/>
                  </div>
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{
                    height: 4, background: T.border, borderRadius: 99, overflow: 'hidden',
                  }}>
                    <div style={{
                      height: '100%', borderRadius: 99, width: `${proBar}%`,
                      background: T.blue, transition: 'width 0.5s ease',
                    }}/>
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
                <span style={{ fontSize: 10, color: day.cals > calorieGoal ? T.coral : T.accent, fontWeight: 600 }}>
                  {day.cals > calorieGoal ? `${Math.round(calBar)}% over` : `${Math.round(calBar)}%`}
                </span>
                <span style={{ fontSize: 10, color: T.blue, fontWeight: 600 }}>{Math.round(proBar)}% · {day.protein.toFixed(1)}g pro</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── MONTH view ────────────────────────────────────────────────────────────────
function MonthView({ mealsAll, calorieGoal, proteinGoal, accountCreatedAt }) {
  const today = new Date();
  const start = new Date(accountCreatedAt + 'T00:00:00');
  const totalDays = Math.max(0, Math.floor((today - start) / (1000 * 60 * 60 * 24)) + 1);

  const weeks = [];
  for (let w = 0; w < Math.ceil(totalDays / 7); w++) {
    const weekDays = [];
    for (let d = 0; d < 7; d++) {
      const dayIndex = w * 7 + d;
      if (dayIndex >= totalDays) break;
      const date = new Date(start);
      date.setDate(start.getDate() + dayIndex);
      const key = toLocalDateKey(date);
      const dayMeals = mealsAll[key] || [];
      weekDays.push({
        key,
        cals: dayMeals.reduce((s, m) => s + (m.calories || 0), 0),
        protein: dayMeals.reduce((s, m) => s + (m.protein || 0), 0),
      });
    }
    const firstDate = new Date(start);
    firstDate.setDate(start.getDate() + w * 7);
    const lastDate = new Date(start);
    lastDate.setDate(start.getDate() + Math.min(w * 7 + 6, totalDays - 1));
    weeks.push({
      label: `Week ${w + 1}`,
      range: `${formatDate(firstDate)} - ${formatDate(lastDate)}`,
      cals: weekDays.reduce((s, d) => s + d.cals, 0),
      protein: weekDays.reduce((s, d) => s + d.protein, 0),
      dayCount: weekDays.length,
    });
  }

  const monthCals = weeks.reduce((s, w) => s + w.cals, 0);
  const monthProtein = weeks.reduce((s, w) => s + w.protein, 0);

  return (
    <div style={{ flex: 1, overflowY: 'auto' }}>
      <PageHeader title="This Month" />

      <div style={{ padding: '16px 16px 24px' }}>
        <div style={{
          background: T.card, borderRadius: 20, padding: 0,
          marginBottom: 18, border: `1px solid ${T.border}`,
          overflow: 'hidden', boxShadow: 'var(--shadow-sm)',
        }}>
          <div style={{ height: 3, background: `linear-gradient(90deg, ${T.accent}, ${T.blue})` }}/>
          <div style={{ padding: '18px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: 12, color: T.muted, fontWeight: 600, letterSpacing: '0.05em' }}>TOTAL</div>
              <div style={{ fontSize: 28, fontWeight: 900, color: T.text, marginTop: 2 }}>{monthCals.toFixed(1)}</div>
              <div style={{ fontSize: 12, color: T.muted, marginTop: 1 }}>calories · {totalDays} days</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 12, color: T.muted, fontWeight: 600, letterSpacing: '0.05em' }}>PROTEIN</div>
              <div style={{ fontSize: 28, fontWeight: 900, color: T.blue, marginTop: 2 }}>{monthProtein.toFixed(1)}g</div>
              <div style={{ fontSize: 12, color: T.muted, marginTop: 1 }}>total</div>
            </div>
          </div>
        </div>

        {weeks.slice().reverse().map((week, i) => {
          const weeklyGoal = calorieGoal * 7;
          return (
            <div key={week.label} style={{
              background: T.card, borderRadius: T.radiusSm,
              border: `1px solid ${T.border}`,
              marginBottom: 10, padding: '16px 18px',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 800, color: T.text }}>{week.label}</div>
                  <div style={{ fontSize: 11, color: T.muted, marginTop: 1 }}>{week.range} · {week.dayCount} days</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 16, fontWeight: 800, color: T.text }}>{week.cals.toFixed(1)} cal</div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: T.blue }}>{week.protein.toFixed(1)}g protein</div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <div style={{
                    height: 5, background: T.border, borderRadius: 99, overflow: 'hidden',
                  }}>
                    <div style={{
                      height: '100%', borderRadius: 99,
                      width: `${Math.min((week.cals / weeklyGoal) * 100, 100)}%`,
                      background: week.cals > weeklyGoal ? T.coral : T.accent,
                    }}/>
                  </div>
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{
                    height: 5, background: T.border, borderRadius: 99, overflow: 'hidden',
                  }}>
                    <div style={{
                      height: '100%', borderRadius: 99,
                      width: `${Math.min((week.protein / (proteinGoal * 7)) * 100, 100)}%`,
                      background: T.blue,
                    }}/>
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 3 }}>
                <span style={{ fontSize: 10, color: week.cals > weeklyGoal ? T.coral : T.accent, fontWeight: 600 }}>
                  {Math.round((week.cals / weeklyGoal) * 100)}% of goal
                </span>
                <span style={{ fontSize: 10, color: T.blue, fontWeight: 600 }}>
                  avg {(week.cals / week.dayCount).toFixed(1)} cal · {(week.protein / week.dayCount).toFixed(1)}g pro / day
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── PROGRESS screen with real data ────────────────────────────────────────────
function ProgressScreen({ meals, mealsAll = {}, calorieGoal }) {
  const DAYS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
  const today = new Date();

  const weekData = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() - (6 - i));
    const key = toLocalDateKey(d);
    const dayMeals = mealsAll[key] || [];
    const cals = dayMeals.reduce((s, m) => s + (m.calories || 0), 0);
    return { d: DAYS[d.getDay()], val: cals, isToday: i === 6 };
  });
  const avg  = Math.round(weekData.reduce((s, x) => s + x.val, 0) / 7);
  const maxV = Math.max(...weekData.map(x => x.val), calorieGoal);

  const foodMap = {};
  Object.values(mealsAll).forEach(dayMeals => {
    dayMeals.forEach(m => {
      foodMap[m.name] = (foodMap[m.name] || 0) + (m.calories || 0);
    });
  });
  const topFoods = Object.entries(foodMap).sort((a, b) => b[1] - a[1]).slice(0, 5);

  return (
    <div style={{ flex: 1, overflowY: 'auto' }}>
      <PageHeader title="Progress"/>

      <div style={{ padding: '16px 16px 24px' }}>

        <div style={{ marginBottom: 4 }}>
          <p style={{ margin: 0, fontSize: 12, fontWeight: 600, color: T.muted, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Average</p>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginTop: 2 }}>
            <span style={{ fontSize: 36, fontWeight: 900, color: T.text, letterSpacing: '-1px' }}>
              {avg.toFixed(1)}
            </span>
            <span style={{ fontSize: 16 }}>🔥</span>
          </div>
        </div>

        <div style={{
          background: T.card, borderRadius: 22, padding: 0,
          marginBottom: 16, border: `1px solid ${T.border}`,
          overflow: 'hidden', boxShadow: 'var(--shadow-sm)',
        }}>
          <div style={{ height: 3, background: `linear-gradient(90deg, ${T.accent}, ${T.accent}88)` }}/>
          <div style={{ padding: '18px 18px 14px' }}>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
              <span style={{ fontSize: 11, color: T.muted, fontWeight: 600 }}>
                Goal {calorieGoal}
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 7, height: 110 }}>
              {weekData.map(({ d, val, isToday }, i) => {
                const hPct = (val / maxV) * 100;
                const isGoalDay = val >= calorieGoal;
                const barColor = isToday ? T.accent : isGoalDay ? T.accent + 'AA' : T.border;
                return (
                  <div key={i} style={{
                    flex: 1, display: 'flex', flexDirection: 'column',
                    alignItems: 'center', justifyContent: 'flex-end', height: '100%', gap: 4,
                  }}>
                    <span style={{ fontSize: 9, color: T.muted, fontWeight: 600, marginBottom: 2 }}>
                      {val > 0 ? val.toFixed(1) : ''}
                    </span>
                    <div style={{
                      width: '100%', height: `${hPct}%`, minHeight: val > 0 ? 6 : 2,
                      borderRadius: '6px 6px 3px 3px', background: barColor,
                      transition: 'height 0.5s ease',
                      border: isToday ? `1px solid ${T.accent}` : 'none',
                    }}/>
                  </div>
                );
              })}
            </div>
            <div style={{ display: 'flex', gap: 7, marginTop: 8 }}>
              {weekData.map(({ d, isToday }, i) => (
                <div key={i} style={{
                  flex: 1, textAlign: 'center', fontSize: 12, fontWeight: 700,
                  color: isToday ? T.accent : T.muted,
                }}>{d}</div>
              ))}
            </div>
          </div>
        </div>

        <div style={{
          background: T.card, borderRadius: 22, padding: '18px 18px',
          border: `1px solid ${T.border}`,
        }}>
          <p style={{
            margin: '0 0 14px', fontSize: 15, fontWeight: 800,
            color: T.text,
          }}>Food highest in calories</p>
          {topFoods.length > 0 ? topFoods.map(([name, cal], i, arr) => (
            <div key={name} style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '9px 0',
              borderBottom: i < arr.length - 1 ? `1px solid ${T.border}` : 'none',
            }}>
              <span style={{ fontSize: 14, fontWeight: 600, color: T.text }}>{name}</span>
              <span style={{ fontSize: 14, fontWeight: 800, color: T.accent }}>{Number(cal).toFixed(1)} Cal</span>
            </div>
          )) : (
            <p style={{ margin: 0, fontSize: 13, color: T.muted, textAlign: 'center', padding: '14px 0' }}>
              No meals logged yet. Start adding meals to see top foods.
            </p>
          )}
        </div>

      </div>
    </div>
  );
}

// ── MEAL PLAN screen ──────────────────────────────────────────────────────────
function MealPlanScreen({ meals, onOpenAdd, onDelete }) {
  const bySlot = {};
  MEAL_SLOTS.forEach(s => { bySlot[s] = []; });
  meals.forEach(m => { const sl = m.slot || 'Breakfast'; if (bySlot[sl]) bySlot[sl].push(m); });

  return (
    <div style={{ flex: 1, overflowY: 'auto' }}>
      <PageHeader title="Meal Plan"/>

      <div style={{ padding: '16px 16px 24px' }}>
        {MEAL_SLOTS.map(slot => {
          const meta      = SLOT_META[slot];
          const slotMeals = bySlot[slot];
          const slotCals  = slotMeals.reduce((s, m) => s + (m.calories || 0), 0);
          const slotProtein = slotMeals.reduce((s, m) => s + (m.protein || 0), 0);
          const accent = meta.color || T.accent;
          const isEmpty = slotMeals.length === 0;

          return (
            <div key={slot} style={{ marginBottom: 22 }}>
              <div style={{
                background: accent + '15', borderRadius: T.radius,
                border: `1px solid ${accent + '25'}`,
                overflow: 'hidden', marginBottom: 10,
              }}>
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '14px 16px',
                  background: accent + '10',
                  borderBottom: `1px solid ${accent + '20'}`,
                }}>
                  <div style={{
                    width: 38, height: 38, borderRadius: 10,
                    background: accent + '20',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <SlotIcon slot={slot} size={18} color={accent}/>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 16, fontWeight: 800, color: T.text }}>{slot}</div>
                    <div style={{ fontSize: 11, color: T.muted, marginTop: 1 }}>{meta.time}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 17, fontWeight: 900, color: accent, lineHeight: 1.2 }}>
                      {slotCals.toFixed(1)}
                    </div>
                    <div style={{ fontSize: 9, color: T.muted, textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: 1 }}>cal</div>
                  </div>
                </div>

                {isEmpty ? (
                  <div style={{
                    padding: '20px 16px', textAlign: 'center',
                    color: T.muted, fontSize: 13, fontWeight: 500,
                  }}>
                    No meals added yet
                  </div>
                ) : (
                  <div style={{ padding: '8px' }}>
                    {slotMeals.map((meal, i) => (
                      <div key={meal.id} style={{
                        display: 'flex', alignItems: 'center', gap: 10,
                        background: T.card, borderRadius: 12,
                        border: `1px solid ${T.border}`,
                        padding: '11px 12px', marginBottom: 6,
                        borderLeft: `3.5px solid ${accent}`,
                      }}>
                        <Avatar name={meal.name} size={36}/>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 14, fontWeight: 700, color: T.text }}>
                            {meal.name}
                          </div>
                          <div style={{ fontSize: 11, color: T.muted, marginTop: 1 }}>
                            {Number(meal.calories).toFixed(1)} cal
                          </div>
                        </div>
                        {meal.protein > 0 && (
                          <div style={{
                            background: accent + '15', borderRadius: 6,
                            padding: '3px 7px', textAlign: 'center',
                          }}>
                            <div style={{ fontSize: 11, fontWeight: 800, color: accent, lineHeight: 1 }}>
                              {Number(meal.protein).toFixed(1)}g
                            </div>
                            <div style={{ fontSize: 8, color: accent, opacity: 0.6, textTransform: 'uppercase' }}>pro</div>
                          </div>
                        )}
                        <button onClick={() => onDelete(meal.id)} style={{
                          width: 28, height: 28, borderRadius: 8, border: 'none',
                          background: T.bg, cursor: 'pointer',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          opacity: 0.6,
                        }}>
                          <svg viewBox="0 0 24 24" fill="none" stroke={T.muted} strokeWidth="2" width="12" height="12">
                            <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                          </svg>
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <button onClick={() => onOpenAdd(slot)} style={{
                width: '100%', padding: '13px',
                borderRadius: T.radius, border: `1.5px dashed ${accent + '50'}`,
                background: accent + '08', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                color: accent, fontSize: 13, fontWeight: 700, fontFamily: 'inherit',
              }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                  stroke={accent} strokeWidth="2.5" strokeLinecap="round">
                  <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                </svg>
                Add to {slot}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Add Food sheet ────────────────────────────────────────────────────────────
function AddFoodSheet({
  show, onClose, addingToSlot, setAddingToSlot,
  foodName, setFoodName, foodCals, setFoodCals,
  foodProtein, setFoodProtein, foodQty, setFoodQty,
  selectedBase, manualCal, setManualCal,
  suggestions, selectedIndex, setSelectedIndex,
  showSuggestions, setShowSuggestions,
  selectFood, handleKeyDown, handleAdd,
  inputRef, suggestRef,
}) {
  if (!show) return null;
  return (
    <Portal>
      <div style={{
        position: 'absolute', inset: 0, zIndex: 1000,
        background: 'var(--overlay)',
        display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
      }} onClick={onClose}>
        <div onClick={e => e.stopPropagation()} style={{
          width: '100%', maxWidth: 480,
          background: T.card,
          borderRadius: '26px 26px 0 0',
          padding: '0 20px 48px',
          animation: 'slideUp 0.3s cubic-bezier(0.34,1.3,0.64,1)',
        }}>
          <div style={{ width: 40, height: 4, background: T.border, borderRadius: 99, margin: '14px auto 20px' }}/>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
            <div style={{
              width: 34, height: 34, borderRadius: 10,
              background: (SLOT_META[addingToSlot]?.color || T.accent) + '18',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <SlotIcon slot={addingToSlot} size={16} color={SLOT_META[addingToSlot]?.color || T.accent}/>
            </div>
            <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: T.text }}>
              Add to {addingToSlot}
            </h3>
          </div>

          <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
            {MEAL_SLOTS.map(s => {
              const on = addingToSlot === s;
              const c  = SLOT_META[s]?.color || T.accent;
              return (
                <button key={s} onClick={() => setAddingToSlot(s)} style={{
                  flex: 1, padding: '8px 0', borderRadius: 10, border: 'none',
                  cursor: 'pointer', fontFamily: 'inherit', fontSize: 11, fontWeight: 700,
                  background: on ? c : T.bg,
                  color: on ? '#fff' : T.muted,
                  transition: 'all 0.15s ease',
                }}>{s}</button>
              );
            })}
          </div>

          <div ref={suggestRef} style={{ position: 'relative', marginBottom: 10 }}>
            <input
              ref={inputRef}
              type="text" placeholder="Search or type food name…"
              value={foodName}
              onChange={e => { setFoodName(e.target.value); setShowSuggestions(true); }}
              onKeyDown={handleKeyDown}
              style={{
                width: '100%', padding: '12px 14px', borderRadius: 12,
                border: `1.5px solid ${T.border}`, background: T.bg,
                color: T.text, fontSize: 14, fontWeight: 600,
                outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box',
              }}
            />
            {showSuggestions && suggestions.length > 0 && (
              <div style={{
                position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 100,
                marginTop: 4, maxHeight: 200, overflowY: 'auto',
                background: T.card, border: `1px solid ${T.border}`, borderRadius: 12,
                boxShadow: '0 8px 24px var(--shadow-color, rgba(0,0,0,0.1))',
              }}>
                {suggestions.map((food, i) => (
                  <button key={food.name} onClick={() => selectFood(food)}
                    onMouseEnter={() => setSelectedIndex(i)}
                    style={{
                      width: '100%', padding: '10px 14px', border: 'none', cursor: 'pointer',
                      background: i === selectedIndex ? T.accentSoft : 'transparent',
                      textAlign: 'left', display: 'flex', alignItems: 'center', gap: 8,
                      fontSize: 13, fontWeight: 600, color: T.text, fontFamily: 'inherit',
                      borderBottom: i < suggestions.length - 1 ? `1px solid ${T.border}` : 'none',
                    }}
                  >
                    <span style={{ flex: 1 }}>{food.name}</span>
                    {food.protein != null && (
                      <span style={{ fontSize: 11, fontWeight: 700, color: T.accent }}>{food.protein}g pro</span>
                    )}
                    <span style={{ fontSize: 11, color: T.muted }}>{food.cal} kcal</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {selectedBase && (
            <p style={{ fontSize: 11, color: T.muted, margin: '0 0 10px 2px' }}>
              1 {selectedBase.unit} = {selectedBase.cal} kcal · {selectedBase.protein}g protein
            </p>
          )}

          <div style={{ display: 'flex', gap: 8, marginBottom: 14, alignItems: 'flex-end' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label style={{ fontSize: 10, fontWeight: 700, color: T.muted, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Qty</label>
              <div style={{ display: 'flex', alignItems: 'center', border: `1.5px solid ${T.border}`, borderRadius: 10, overflow: 'hidden', background: T.bg }}>
                <button onClick={() => setFoodQty(q => Math.max(1, q - 1))}
                  style={{ padding: '8px 9px', border: 'none', background: 'transparent', cursor: 'pointer', color: T.text, fontSize: 15, fontWeight: 700, fontFamily: 'inherit' }}>−</button>
                <input type="number" min="1" step="1" value={foodQty}
                  onChange={e => { const v = parseInt(e.target.value) || 1; setFoodQty(v); if (selectedBase) setManualCal(false); }}
                  style={{ width: 36, padding: '8px 2px', border: 'none', borderLeft: `1.5px solid ${T.border}`, borderRight: `1.5px solid ${T.border}`, background: 'transparent', color: T.text, fontSize: 13, fontWeight: 700, textAlign: 'center', outline: 'none', fontFamily: 'inherit' }}
                />
                <button onClick={() => setFoodQty(q => q + 1)}
                  style={{ padding: '8px 9px', border: 'none', background: 'transparent', cursor: 'pointer', color: T.text, fontSize: 15, fontWeight: 700, fontFamily: 'inherit' }}>+</button>
              </div>
            </div>

            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label style={{ fontSize: 10, fontWeight: 700, color: T.muted, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Calories</label>
              <input type="number" placeholder="0" value={foodCals}
                onChange={e => { setFoodCals(e.target.value); setManualCal(true); }}
                style={{
                  width: '100%', padding: '10px', borderRadius: 10,
                  border: `1.5px solid ${manualCal && selectedBase ? T.amber : T.border}`,
                  background: manualCal && selectedBase ? 'var(--amber-soft)' : T.bg,
                  color: T.text, fontSize: 14, fontWeight: 700, textAlign: 'center',
                  outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box',
                }}
              />
            </div>

            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label style={{ fontSize: 10, fontWeight: 700, color: T.accent, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Protein g</label>
              <input type="number" placeholder="0" value={foodProtein}
                onChange={e => setFoodProtein(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleAdd()}
                style={{
                  width: '100%', padding: '10px', borderRadius: 10,
                  border: `1.5px solid ${T.accent}40`,
                  background: T.accentSoft,
                  color: T.text, fontSize: 14, fontWeight: 700, textAlign: 'center',
                  outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box',
                }}
              />
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={onClose} style={{
              flex: 1, padding: '14px', borderRadius: T.radius,
              border: `1px solid ${T.border}`, background: 'transparent',
              color: T.muted, fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
            }}>Cancel</button>
            <button onClick={handleAdd} style={{
              flex: 2, padding: '14px', borderRadius: T.radius, border: 'none',
              background: foodName.trim() ? T.accent : T.border,
              color: foodName.trim() ? '#fff' : T.muted,
              fontSize: 14, fontWeight: 700,
              cursor: foodName.trim() ? 'pointer' : 'default', fontFamily: 'inherit',
            }}>Add Food</button>
          </div>
        </div>
      </div>
    </Portal>
  );
}

// ── Goals sheet ───────────────────────────────────────────────────────────────
function GoalsSheet({ show, onClose, goalInput, setGoalInput, proteinInput, setProteinInput, onSave }) {
  if (!show) return null;
  return (
    <Portal>
      <div style={{
        position: 'absolute', inset: 0, zIndex: 1000,
        background: 'var(--overlay)',
        display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
      }} onClick={onClose}>
        <div onClick={e => e.stopPropagation()} style={{
          width: '100%', maxWidth: 480,
          background: T.card, borderRadius: '28px 28px 0 0',
          padding: '0 24px 40px',
          animation: 'slideUp 0.3s cubic-bezier(0.34,1.3,0.64,1)',
        }}>
          <div style={{ width: 40, height: 4, background: T.border, borderRadius: 99, margin: '14px auto 22px' }}/>

          <div style={{ textAlign: 'center', marginBottom: 32 }}>
            <h3 style={{
              margin: '0 0 6px', fontSize: 24, fontWeight: 800,
              color: T.text, letterSpacing: '-0.5px',
              fontFamily: "'Inter', 'Outfit', system-ui, sans-serif",
            }}>
              Edit Goal
            </h3>
            <p style={{ margin: 0, fontSize: 14, color: T.muted }}>
              Set your daily calorie and protein targets
            </p>
          </div>

          <div style={{ marginBottom: 18 }}>
            <label style={{
              display: 'block', marginBottom: 8, fontSize: 13, fontWeight: 700,
              color: T.text,
            }}>
              Calories per day
            </label>
            <input type="number" placeholder="e.g. 2000" value={goalInput}
              onChange={e => setGoalInput(e.target.value)}
              style={{
                width: '100%', padding: '14px 16px', borderRadius: 14, border: `1.5px solid ${T.border}`,
                background: T.bg, color: T.text, fontSize: 16, fontWeight: 700,
                outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box',
              }}/>
          </div>

          <div style={{ marginBottom: 32 }}>
            <label style={{
              display: 'block', marginBottom: 8, fontSize: 13, fontWeight: 700,
              color: T.text,
            }}>
              Protein per day (g)
            </label>
            <input type="number" placeholder="e.g. 150" value={proteinInput}
              onChange={e => setProteinInput(e.target.value)}
              style={{
                width: '100%', padding: '14px 16px', borderRadius: 14, border: `1.5px solid ${T.border}`,
                background: T.bg, color: T.text, fontSize: 16, fontWeight: 700,
                outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box',
              }}/>
          </div>

          <button onClick={onSave} style={{
            width: '100%', padding: '16px', borderRadius: 14, border: 'none',
            background: T.accent, color: '#fff', fontSize: 16, fontWeight: 800,
            cursor: 'pointer', fontFamily: 'inherit', letterSpacing: '0.01em',
          }}>
            Save Goals
          </button>
        </div>
      </div>
    </Portal>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function MealTracker({ store, setActiveTab: parentSetTab, hideNav }) {
  const {
    getTodayMeals, addMeal, deleteMeal,
    calorieGoal, setCalorieGoal,
    proteinGoal = 150, setProteinGoal,
    meals: mealsAll, accountCreatedAt,
  } = store;

  const [screen,        setScreen]        = useState('today');
  const [timePeriod,    setTimePeriod]    = useState('day');
  const [showAdd,       setShowAdd]       = useState(false);
  const [addingToSlot,  setAddingToSlot]  = useState('Breakfast');
  const [showGoal,      setShowGoal]      = useState(false);
  const [goalInput,     setGoalInput]     = useState(String(calorieGoal));
  const [proteinInput,  setProteinInput]  = useState(String(proteinGoal));

  const [foodName,      setFoodName]      = useState('');
  const [foodCals,      setFoodCals]      = useState('');
  const [foodProtein,   setFoodProtein]   = useState('');
  const [foodQty,       setFoodQty]       = useState(1);
  const [selectedBase,  setSelectedBase]  = useState(null);
  const [manualCal,     setManualCal]     = useState(false);
  const [showSuggest,   setShowSuggest]   = useState(false);
  const [selIndex,      setSelIndex]      = useState(0);

  const inputRef   = useRef(null);
  const suggestRef = useRef(null);

  useEffect(() => {
    if (hideNav) hideNav(true);
    return () => { if (hideNav) hideNav(false); };
  }, []);

  useEffect(() => { if (showAdd && inputRef.current) inputRef.current.focus(); }, [showAdd]);

  useEffect(() => {
    if (selectedBase && !manualCal) {
      setFoodCals(String(selectedBase.cal * foodQty));
      setFoodProtein(selectedBase.protein != null
        ? String(Math.round(selectedBase.protein * foodQty * 10) / 10) : '0');
    }
  }, [foodQty, selectedBase, manualCal]);

  const suggestions = useMemo(() => {
    if (!foodName.trim()) return [];
    const q = foodName.toLowerCase();
    return FOODS.filter(f => f.name.toLowerCase().includes(q)).slice(0, 8);
  }, [foodName]);

  useEffect(() => { setSelIndex(0); setShowSuggest(suggestions.length > 0); }, [suggestions]);

  const selectFood = (food) => {
    setSelectedBase(food);
    setFoodName(food.name);
    setFoodQty(1);
    setFoodCals(String(food.cal));
    setFoodProtein(food.protein != null ? String(food.protein) : '0');
    setManualCal(false);
    setShowSuggest(false);
  };

  const handleKeyDown = (e) => {
    if (!showSuggest) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setSelIndex(i => Math.min(i+1, suggestions.length-1)); }
    if (e.key === 'ArrowUp')   { e.preventDefault(); setSelIndex(i => Math.max(i-1, 0)); }
    if (e.key === 'Enter' && showSuggest) { e.preventDefault(); selectFood(suggestions[selIndex]); }
    if (e.key === 'Escape') setShowSuggest(false);
  };

  const handleAdd = () => {
    if (!foodName.trim()) return;
    addMeal({
      name:     foodName.trim(),
      calories: parseInt(foodCals)    || 0,
      protein:  parseFloat(foodProtein) || 0,
      slot:     addingToSlot,
    });
    setFoodName(''); setFoodCals(''); setFoodProtein(''); setFoodQty(1);
    setSelectedBase(null); setManualCal(false); setShowAdd(false);
  };

  const openAddForSlot = (slot) => {
    setAddingToSlot(slot);
    setFoodName(''); setFoodCals(''); setFoodProtein(''); setFoodQty(1);
    setSelectedBase(null); setManualCal(false); setShowAdd(true);
  };

  const handleBack = () => {
    if (hideNav) hideNav(false);
    if (parentSetTab) parentSetTab('dashboard');
  };

  const meals = getTodayMeals().sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));

  const periodTabs = [
    { id: 'day',   label: 'Day' },
    { id: 'week',  label: 'Week' },
    { id: 'month', label: 'Month' },
  ];

  const showPeriodTabs = screen === 'today';

  const anyOverlay = showGoal || showAdd;
  useEffect(() => {
    const el = document.getElementById('app-content-scroll');
    if (!el) return;
    el.style.overflowY = anyOverlay ? 'hidden' : 'auto';
    return () => { el.style.overflowY = 'auto'; };
  }, [anyOverlay]);

  return (
    <div style={{
      display: 'flex', flexDirection: 'column',
      minHeight: '100%', background: T.bg, position: 'relative',
      fontFamily: "'Inter', 'Outfit', system-ui, sans-serif",
    }}>
      {/* Top bar with back button */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 4,
        padding: '12px 12px 0',
      }}>
        <button onClick={handleBack} style={{
          width: 36, height: 36, borderRadius: 10,
          background: T.bg, border: `1px solid ${T.border}`,
          cursor: 'pointer', display: 'flex', alignItems: 'center',
          justifyContent: 'center', color: T.text, flexShrink: 0,
        }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5"/><path d="M12 19l-7-7 7-7"/>
          </svg>
        </button>
        <span style={{
          fontSize: 17, fontWeight: 800, color: T.text,
          letterSpacing: '-0.2px',
        }}>Meal Planner</span>
      </div>

      {/* Period tabs (Day / Week / Month) */}
      {showPeriodTabs && (
        <div style={{ display: 'flex', gap: 4, padding: '10px 20px 0' }}>
          {periodTabs.map((t, i) => (
            <span key={t.id} onClick={() => setTimePeriod(t.id)} style={{
              fontSize: 14, fontWeight: timePeriod === t.id ? 700 : 500,
              color: timePeriod === t.id ? T.text : T.muted,
              paddingBottom: 6,
              borderBottom: timePeriod === t.id ? `2.5px solid ${T.accent}` : '2.5px solid transparent',
              marginRight: 12, cursor: 'pointer',
            }}>{t.label}</span>
          ))}
        </div>
      )}

      {/* Screens */}
      {screen === 'today' && (
        <TodayScreen
          meals={meals}
          mealsAll={mealsAll || {}}
          calorieGoal={calorieGoal}
          proteinGoal={proteinGoal}
          timePeriod={timePeriod}
          accountCreatedAt={accountCreatedAt}
          onOpenAdd={openAddForSlot}
          onDelete={deleteMeal}
          onGoals={() => { setGoalInput(String(calorieGoal)); setProteinInput(String(proteinGoal)); setShowGoal(true); }}
        />
      )}
      {screen === 'progress' && (
        <ProgressScreen meals={meals} mealsAll={mealsAll || {}} calorieGoal={calorieGoal}/>
      )}
      {screen === 'mealplan' && (
        <MealPlanScreen meals={meals} onOpenAdd={openAddForSlot} onDelete={deleteMeal}/>
      )}

      {/* Bottom nav */}
      <BottomNav active={screen} onSelect={setScreen}/>

      {/* Sheets */}
      <AddFoodSheet
        show={showAdd} onClose={() => setShowAdd(false)}
        addingToSlot={addingToSlot} setAddingToSlot={setAddingToSlot}
        foodName={foodName} setFoodName={setFoodName}
        foodCals={foodCals} setFoodCals={setFoodCals}
        foodProtein={foodProtein} setFoodProtein={setFoodProtein}
        foodQty={foodQty} setFoodQty={setFoodQty}
        selectedBase={selectedBase} manualCal={manualCal} setManualCal={setManualCal}
        suggestions={suggestions} selectedIndex={selIndex} setSelectedIndex={setSelIndex}
        showSuggestions={showSuggest} setShowSuggestions={setShowSuggest}
        selectFood={selectFood} handleKeyDown={handleKeyDown} handleAdd={handleAdd}
        inputRef={inputRef} suggestRef={suggestRef}
      />

      <GoalsSheet
        show={showGoal} onClose={() => setShowGoal(false)}
        goalInput={goalInput} setGoalInput={setGoalInput}
        proteinInput={proteinInput} setProteinInput={setProteinInput}
        onSave={() => {
          const g = parseInt(goalInput);
          const p = parseInt(proteinInput);
          if (g > 0) setCalorieGoal(g);
          if (p > 0 && setProteinGoal) setProteinGoal(p);
          setShowGoal(false);
        }}
      />
    </div>
  );
}
