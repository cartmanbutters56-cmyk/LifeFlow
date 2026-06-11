import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { inputStyle, Portal } from '../components/UI';
import { toLocalDateKey } from '../data/sessionService';

const PER_UNIT = 8;
const OZ_TO_ML = 29.5735;

function BigBottle({ pct, animated, isDark }) {
  const bW = 130;
  const bH = 260;
  const neckH = 40;
  const bodyH = bH - neckH;
  const bodyW = bW;
  const neckW = bW * 0.4;
  const fillH = (pct / 100) * bodyH;
  const animFillH = animated ? (animated / 100) * bodyH : fillH;

  const glass = isDark ? 'rgba(255,255,255,0.10)' : 'rgba(148,163,184,0.15)';
  const glassHi = isDark ? 'rgba(255,255,255,0.15)' : 'rgba(148,163,184,0.25)';
  const border = isDark ? 'rgba(255,255,255,0.25)' : 'rgba(148,163,184,0.35)';
  const cap = isDark ? 'rgba(255,255,255,0.12)' : 'rgba(148,163,184,0.30)';

  return (
    <svg width={bW + 20} height={bH + 20} viewBox={`-10 -10 ${bW + 30} ${bH + 30}`} style={{ display: 'block', filter: 'drop-shadow(0 8px 32px var(--water-soft))' }}>
      <defs>
        <linearGradient id="bottleBody" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor={glass} />
          <stop offset="50%" stopColor={glassHi} />
          <stop offset="100%" stopColor={glass} />
        </linearGradient>
        <linearGradient id="bottleFillGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--metric-water)" />
          <stop offset="50%" stopColor="var(--brand-tertiary)" />
          <stop offset="100%" stopColor="var(--metric-water)" />
        </linearGradient>
        <linearGradient id="bottleGloss" x1="0" y1="0" x2="0.3" y2="1">
          <stop offset="0%" stopColor="rgba(255,255,255,0.5)" />
          <stop offset="100%" stopColor="rgba(255,255,255,0)" />
        </linearGradient>
        <clipPath id="bottleClip">
          <path d={`
            M${bW / 2 - neckW / 2 + 6},2
            Q${bW / 2 - neckW / 2},2 ${bW / 2 - neckW / 2},8
            L${bW / 2 - neckW / 2},${neckH - 2}
            Q${bW / 2 - neckW / 2},${neckH + 2} ${bW / 2 - bodyW / 2 + 10},${neckH + 2}
            L${bW / 2 - bodyW / 2 + 10},${neckH + 6}
            Q${bW / 2 - bodyW / 2},${neckH + 6} ${bW / 2 - bodyW / 2},${neckH + 16}
            L${bW / 2 - bodyW / 2},${bH - 14}
            Q${bW / 2 - bodyW / 2},${bH - 4} ${bW / 2 - bodyW / 2 + 10},${bH - 4}
            L${bW / 2 + bodyW / 2 - 10},${bH - 4}
            Q${bW / 2 + bodyW / 2},${bH - 4} ${bW / 2 + bodyW / 2},${bH - 14}
            L${bW / 2 + bodyW / 2},${neckH + 16}
            Q${bW / 2 + bodyW / 2},${neckH + 6} ${bW / 2 + bodyW / 2 - 10},${neckH + 6}
            L${bW / 2 + bodyW / 2 - 10},${neckH + 2}
            Q${bW / 2 + bodyW / 2},${neckH + 2} ${bW / 2 + bodyW / 2},${neckH - 2}
            L${bW / 2 + bodyW / 2},8
            Q${bW / 2 + bodyW / 2},2 ${bW / 2 + neckW / 2 - 6},2
            Z
          `} />
        </clipPath>
      </defs>

      {/* Bottle outline */}
      <path d={`
        M${bW / 2 - neckW / 2 + 6},2
        Q${bW / 2 - neckW / 2},2 ${bW / 2 - neckW / 2},8
        L${bW / 2 - neckW / 2},${neckH - 2}
        Q${bW / 2 - neckW / 2},${neckH + 2} ${bW / 2 - bodyW / 2 + 10},${neckH + 2}
        L${bW / 2 - bodyW / 2 + 10},${neckH + 6}
        Q${bW / 2 - bodyW / 2},${neckH + 6} ${bW / 2 - bodyW / 2},${neckH + 16}
        L${bW / 2 - bodyW / 2},${bH - 14}
        Q${bW / 2 - bodyW / 2},${bH - 4} ${bW / 2 - bodyW / 2 + 10},${bH - 4}
        L${bW / 2 + bodyW / 2 - 10},${bH - 4}
        Q${bW / 2 + bodyW / 2},${bH - 4} ${bW / 2 + bodyW / 2},${bH - 14}
        L${bW / 2 + bodyW / 2},${neckH + 16}
        Q${bW / 2 + bodyW / 2},${neckH + 6} ${bW / 2 + bodyW / 2 - 10},${neckH + 6}
        L${bW / 2 + bodyW / 2 - 10},${neckH + 2}
        Q${bW / 2 + bodyW / 2},${neckH + 2} ${bW / 2 + bodyW / 2},${neckH - 2}
        L${bW / 2 + bodyW / 2},8
        Q${bW / 2 + bodyW / 2},2 ${bW / 2 + neckW / 2 - 6},2
        Z
      `} fill="url(#bottleBody)" stroke={border} strokeWidth="1.5" />

      {/* Cap */}
      <rect x={bW / 2 - neckW / 2 + 2} y={0} width={neckW - 4} height={8} rx={4} fill={cap} />

      {/* Fill level */}
      {(pct > 0 || animated > 0) && (
        <g clipPath="url(#bottleClip)">
          <rect x={bW / 2 - bodyW / 2} y={bH - animFillH - 4} width={bodyW} height={animFillH} fill="url(#bottleFillGrad)" opacity="0.75" />
          {/* Wave shimmer */}
          <rect x={bW / 2 - bodyW / 2} y={bH - animFillH - 4} width={bodyW} height={animFillH} fill="url(#bottleGloss)" />
          {/* Bubbles */}
          {Array.from({ length: Math.min(Math.floor(animated / 8) + 1, 8) }).map((_, i) => (
            <circle key={i} cx={bW / 2 + (i % 2 === 0 ? -18 : 18) + Math.sin(i * 2) * 8}
              cy={bH - 24 - i * (animFillH / 8) + Math.cos(i * 3) * 6}
              r={2 + (i % 3)} fill="rgba(255,255,255,0.35)" />
          ))}
        </g>
      )}

      {/* Water surface line */}
      {(pct > 0 || animated > 0) && (
        <line x1={bW / 2 - bodyW / 2 + 12} y1={bH - animFillH - 2} x2={bW / 2 + bodyW / 2 - 12} y2={bH - animFillH - 2}
          stroke="rgba(255,255,255,0.4)" strokeWidth="1.5" strokeLinecap="round" />
      )}
    </svg>
  );
}

function Droplet({ filled, index, onTap, onLongPress }) {
  const [ripple, setRipple] = useState(false);
  const [pressing, setPressing] = useState(false);
  const [enter, setEnter] = useState(false);
  const timerRef = useRef(null);
  const triggered = useRef(false);

  useEffect(() => {
    const t = setTimeout(() => setEnter(true), index * 25);
    return () => clearTimeout(t);
  }, [index]);

  const clear = () => {
    clearTimeout(timerRef.current);
    timerRef.current = null;
    triggered.current = false;
    setPressing(false);
  };

  const handleDown = () => {
    triggered.current = false;
    setPressing(true);
    timerRef.current = setTimeout(() => {
      triggered.current = true;
      setPressing(false);
      onLongPress(index);
    }, 400);
  };

  const handleUp = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (!triggered.current) {
      setRipple(true);
      setTimeout(() => setRipple(false), 500);
      onTap(index);
    }
    setPressing(false);
    triggered.current = false;
  };

  return (
    <div style={{ position: 'relative', display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
      <div
        onPointerDown={handleDown}
        onPointerUp={handleUp}
        onPointerLeave={clear}
        onPointerCancel={clear}
        style={{
          cursor: 'pointer',
          transform: pressing ? 'scale(0.85)' : ripple ? 'scale(1.15)' : enter ? 'scale(1)' : 'scale(0)',
          transition: 'transform 0.2s cubic-bezier(0.34,1.56,0.64,1)',
          WebkitTapHighlightColor: 'transparent',
          touchAction: 'manipulation',
          borderRadius: '50%',
          padding: 4,
          opacity: enter ? 1 : 0,
          filter: filled ? 'saturate(1.2)' : 'saturate(0.3) brightness(0.7)',
        }}
      >
        <span style={{ fontSize: 34, lineHeight: 1, display: 'block' }}>{filled ? '💧' : '💧'}</span>
      </div>
      {ripple && (
        <div style={{
          position: 'absolute', inset: -16, borderRadius: '50%',
          background: 'var(--water-soft)',
          animation: 'dropRipple 0.5s ease-out forwards',
          pointerEvents: 'none',
        }} />
      )}
    </div>
  );
}

function ozToDisplay(oz, unit) {
  if (!oz) return 0;
  if (unit === 'ml') return oz * OZ_TO_ML;
  if (unit === 'cups') return oz / PER_UNIT;
  return oz;
}

export default function WaterTracker({ store, user, setActiveTab }) {
  const {
    todayWater, waterGoal, setWaterGoal, addWater, resetWater, effectiveTheme,
    waterUnit, waterIntake,
  } = store;

  const goalRef = useRef(null);
  const [showGoalModal, setShowGoalModal] = useState(false);
  const [customGoal, setCustomGoal] = useState('');
  const [showCelebration, setShowCelebration] = useState(false);
  const [animBounce, setAnimBounce] = useState(false);
  const [animPct, setAnimPct] = useState(0);
  const prevPct = useRef(0);
  const rafRef = useRef(null);

  const reminderPrefix = user?.uid ? `wt_reminder_${user.uid}_` : 'wt_reminder_';

  const [reminderEnabled, setReminderEnabled] = useState(false);
  const [reminderInterval, setReminderInterval] = useState(45);

  useEffect(() => {
    try {
      setReminderEnabled(JSON.parse(localStorage.getItem(reminderPrefix + 'on') || 'false'));
      const v = parseInt(localStorage.getItem(reminderPrefix + 'interval'));
      setReminderInterval(v > 0 ? v : 45);
    } catch { setReminderEnabled(false); setReminderInterval(45); }
  }, [reminderPrefix]);

  useEffect(() => { try { localStorage.setItem(reminderPrefix + 'on', JSON.stringify(reminderEnabled)); } catch {} }, [reminderEnabled, reminderPrefix]);
  useEffect(() => { try { localStorage.setItem(reminderPrefix + 'interval', String(reminderInterval)); } catch {} }, [reminderInterval, reminderPrefix]);

  const anyOverlayOpen = showGoalModal || showCelebration;
  useEffect(() => {
    const el = document.getElementById('app-content-scroll');
    if (!el) return;
    el.style.overflowY = anyOverlayOpen ? 'hidden' : 'auto';
    return () => { el.style.overflowY = 'auto'; };
  }, [anyOverlayOpen]);

  const totalUnits = waterUnit === 'cups' ? Math.max(Math.ceil(waterGoal / PER_UNIT), 1) : 0;
  const filledUnits = waterUnit === 'cups' ? Math.min(Math.floor(todayWater / PER_UNIT), totalUnits) : 0;

  const displayIntake = ozToDisplay(todayWater, waterUnit);
  const displayGoal = ozToDisplay(waterGoal, waterUnit);
  const unitLabel = waterUnit === 'cups' ? 'glasses' : waterUnit === 'ml' ? 'ml' : 'oz';
  const displayIntakeStr = displayIntake < 0.01 ? '0' : displayIntake % 1 === 0 ? String(Math.round(displayIntake)) : displayIntake.toFixed(1);
  const displayGoalStr = waterUnit === 'ml' ? Math.round(displayGoal).toLocaleString() : String(Math.round(displayGoal));
  const pct = Math.min((todayWater / waterGoal) * 100, 100);

  useEffect(() => {
    if (waterUnit === 'cups') { setAnimPct(pct); return; }
    let running = true;
    const raf = () => {
      setAnimPct(prev => {
        const diff = pct - prev;
        if (Math.abs(diff) < 0.3) {
          running = false;
          return pct;
        }
        return prev + diff * 0.08;
      });
      if (running) rafRef.current = requestAnimationFrame(raf);
    };
    rafRef.current = requestAnimationFrame(raf);
    return () => { running = false; cancelAnimationFrame(rafRef.current); };
  }, [pct, waterUnit]);

  useEffect(() => {
    if (pct >= 100 && prevPct.current < 100) {
      setShowCelebration(true);
      setTimeout(() => setShowCelebration(false), 3000);
    }
    prevPct.current = pct;
  }, [pct]);

  const handleTapUnit = useCallback((index) => {
    if (index < 0 || index >= totalUnits) return;
    if (index < filledUnits) {
      if (todayWater > 0) addWater(-Math.min(PER_UNIT, todayWater));
    } else {
      const add = Math.min(PER_UNIT, waterGoal - todayWater);
      if (add > 0) {
        addWater(add);
        setAnimBounce(true);
        setTimeout(() => setAnimBounce(false), 400);
      }
    }
  }, [filledUnits, totalUnits, addWater, waterGoal, todayWater]);

  const handleLongPressUnit = useCallback((index) => {
    if (index < filledUnits) {
      addWater(-Math.min(PER_UNIT, todayWater));
    }
  }, [filledUnits, addWater, todayWater]);

  const rows = [];
  const unitsPerRow = 4;
  for (let r = 0; r < Math.ceil(totalUnits / unitsPerRow); r++) {
    rows.push(Array.from({ length: unitsPerRow }).map((_, c) => {
      const idx = r * unitsPerRow + c;
      return idx < totalUnits ? idx : -1;
    }));
  }

  const getMotivation = () => {
    if (pct >= 100) return "You've hit your daily goal! Well done.";
    if (pct >= 75) return 'Almost there! Just a few more.';
    if (pct >= 50) return 'Halfway there! Keep it going.';
    if (pct >= 25) return 'Good start. Stay on track!';
    return 'Start logging your water intake.';
  };

  const handleQuickAdd = (val) => {
    if (val === 0) return;
    const oz = waterUnit === 'cups' ? val * PER_UNIT : waterUnit === 'ml' ? val / OZ_TO_ML : val;
    addWater(oz);
    setAnimBounce(true);
    setTimeout(() => setAnimBounce(false), 400);
  };

  const recentDates = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - i);
    return toLocalDateKey(d);
  });
  const recentIntakes = recentDates.map(d => waterIntake[d] || 0);
  const avgRecent = Math.round(ozToDisplay(recentIntakes.reduce((s, v) => s + v, 0) / 7, waterUnit));
  const minRecent = Math.round(ozToDisplay(Math.min(...recentIntakes), waterUnit));
  const maxRecent = Math.round(ozToDisplay(Math.max(...recentIntakes), waterUnit));

  return (
    <div style={{
      padding: '20px 18px 20px',
      minHeight: '100%',
      background: 'var(--bg-gradient)',
    }}>
      {/* Celebration */}
      {showCelebration && createPortal(
        <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{
            position: 'absolute', inset: 0,
            background: 'radial-gradient(circle at 50% 50%, rgba(6,182,212,0.15), transparent)',
            animation: 'fadeIn 0.6s',
          }} />
          {Array.from({ length: 24 }).map((_, i) => (
            <div key={i} style={{
              position: 'absolute', left: `${Math.random() * 100}%`, top: `${Math.random() * 100}%`,
              fontSize: 24, animation: `confettiFall 1.8s ease-out ${i * 0.04}s both`,
            }}>
              {['💧','🎉','⭐','✨','💦','🏆','🌟','💙'][i % 8]}
            </div>
          ))}
          <div style={{
            background: 'var(--header-gradient)',
            borderRadius: 22, padding: '20px 32px',
            boxShadow: '0 8px 64px var(--accent-soft)',
            animation: 'popIn 0.4s cubic-bezier(0.34,1.56,0.64,1)',
            textAlign: 'center', color: '#fff',
          }}>
            <div style={{ fontSize: 42, marginBottom: 6 }}>🏆</div>
            <div style={{ fontSize: 20, fontWeight: 800 }}>Goal Reached!</div>
            <div style={{ fontSize: 13, opacity: 0.75, marginTop: 4 }}>Amazing hydration today!</div>
          </div>
        </div>,
        document.getElementById('modal-portal')
      )}

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '0 0 14px' }}>
        <button onClick={() => setActiveTab('gym')} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, display: 'flex', alignItems: 'center' }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--text)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5" /><path d="M12 19l-7-7 7-7" />
          </svg>
        </button>
        <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)' }}>Hydration</span>
      </div>

      {/* Counter */}
      <div style={{
        textAlign: 'center', marginBottom: 10,
        padding: '18px 16px',
        background: 'var(--surface)',
        borderRadius: 16,
        border: '1px solid var(--border)',
      }}>
        <div style={{
          fontSize: 32, fontWeight: 900, color: 'var(--water)',
          letterSpacing: '-1px', lineHeight: 1,
          fontFamily: "'Outfit', sans-serif",
          transform: animBounce ? 'scale(1.06)' : 'scale(1)',
          transition: 'transform 0.25s cubic-bezier(0.34,1.56,0.64,1)',
        }}>
          {displayIntakeStr}
          <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-muted)', letterSpacing: 0 }}>
            {' '}/ {displayGoalStr}
          </span>
        </div>
        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginTop: 4, letterSpacing: '0.04em' }}>
          {unitLabel}
        </div>
      </div>

      {/* Motivation */}
      <div style={{ textAlign: 'center', fontSize: 12, color: 'var(--water)', fontWeight: 600, marginBottom: 18, opacity: 0.85 }}>
        {getMotivation()}
      </div>

      {/* Main visual: Big Bottle (oz/ml) or Droplet Grid (cups) */}
      {waterUnit !== 'cups' ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 16 }}>
          <div style={{
            position: 'relative',
            transform: animBounce ? 'scale(1.02)' : 'scale(1)',
            transition: 'transform 0.25s cubic-bezier(0.34,1.56,0.64,1)',
          }}>
            <BigBottle pct={pct} animated={animPct} isDark={effectiveTheme === 'dark'} />
            {/* Percentage label on bottle */}
            <div style={{
              position: 'absolute', top: '42%', left: '50%', transform: 'translate(-50%, -50%)',
              textAlign: 'center',
            }}>
              <div style={{ fontSize: 26, fontWeight: 900, color: '#fff', fontFamily: "'Outfit', sans-serif", textShadow: '0 2px 8px rgba(0,0,0,0.3)' }}>
                {Math.round(animPct)}%
              </div>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.6)', letterSpacing: '0.04em' }}>
                full
              </div>
            </div>
          </div>

        </div>
      ) : (
        <>
          {/* Progress ring (cups mode) */}
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 14 }}>
            <div style={{ position: 'relative', width: 90, height: 90 }}>
              <svg width={90} height={90} style={{ transform: 'rotate(-90deg)' }}>
                <circle cx={45} cy={45} r={38} fill="none" stroke="var(--border)" strokeWidth={5} />
                <circle cx={45} cy={45} r={38} fill="none" stroke="url(#waterGrad)" strokeWidth={5}
                  strokeDasharray={`${pct * 2.39} ${239}`} strokeLinecap="round"
                  style={{ transition: 'stroke-dasharray 0.8s cubic-bezier(0.34,1.56,0.64,1)' }}
                />
              </svg>
              <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ fontSize: 22, lineHeight: 1 }}>💧</span>
                <span style={{ fontSize: 11, fontWeight: 900, color: 'var(--water)', fontFamily: "'Outfit', sans-serif" }}>
                  {Math.round(pct)}%
                </span>
              </div>
            </div>
          </div>

          {/* Droplet grid */}
          <div style={{
            fontSize: 11, fontWeight: 600, color: 'var(--text-muted)',
            textAlign: 'center', marginBottom: 6,
          }}>
            Tap water · Hold to remove
          </div>
          <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
            marginBottom: 20,
            padding: '18px 12px',
            background: 'var(--surface)',
            borderRadius: 20,
            border: '1px solid var(--border)',
          }}>
            {rows.map((row, ri) => (
              <div key={ri} style={{ display: 'flex', gap: 2, justifyContent: 'center' }}>
                {row.map((idx, ci) => (
                  idx >= 0 ? (
                    <Droplet
                      key={idx}
                      filled={idx < filledUnits}
                      index={idx}
                      onTap={handleTapUnit}
                      onLongPress={handleLongPressUnit}
                    />
                  ) : (
                    <div key={`e-${ci}`} style={{ width: 42, height: 54 }} />
                  )
                ))}
              </div>
            ))}
          </div>
        </>
      )}

      {/* Custom Add / Remove */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <input
          style={{ ...inputStyle, flex: 1, borderRadius: 14 }}
          type="number" min="0"
          placeholder={`${unitLabel} amount`}
          value={customGoal}
          onChange={e => setCustomGoal(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleQuickAdd(Math.max(0, parseFloat(customGoal) || 0))}
        />
        <button onClick={() => {
          const v = Math.max(0, parseFloat(customGoal) || 0);
          if (v > 0) {
            handleQuickAdd(v);
            setCustomGoal(' ');
          }
        }} style={{
          padding: '12px 20px', borderRadius: 14, border: 'none', cursor: 'pointer',
          background: 'var(--water)', color: '#fff', fontWeight: 700, fontSize: 13,
          fontFamily: 'inherit',
        }}>
          Add
        </button>
        <button onClick={() => {
          const v = Math.max(0, parseFloat(customGoal) || 0);
          if (v > 0) {
            handleQuickAdd(-v);
            setCustomGoal(' ');
          }
        }} style={{
          padding: '12px 20px', borderRadius: 14, border: 'none', cursor: 'pointer',
          background: 'var(--pill-bg)', color: 'var(--text3)', fontWeight: 700, fontSize: 13,
          fontFamily: 'inherit',
        }}>
          Remove
        </button>
      </div>

      {/* Reminder */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '10px 16px', marginBottom: 10,
        background: 'var(--pill-bg)',
        borderRadius: 16,
        border: '1px solid var(--border)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 18 }}>🔔</span>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>
              {reminderEnabled ? 'Reminders On' : 'Reminders Off'}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>
              Every {reminderInterval} minutes
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <select value={reminderInterval} onChange={e => setReminderInterval(parseInt(e.target.value))} style={{
            padding: '6px 8px', borderRadius: 10, border: '1px solid var(--border)',
            background: 'var(--surface)', color: 'var(--text)', fontSize: 12, fontWeight: 600,
            fontFamily: 'inherit', cursor: 'pointer', outline: 'none',
          }}>
            {[15, 30, 45, 60, 90, 120].map(m => (
              <option key={m} value={m}>Every {m}min</option>
            ))}
          </select>
          <button onClick={() => setReminderEnabled(v => !v)} style={{
            width: 38, height: 26, borderRadius: 13,
            background: reminderEnabled ? 'var(--water)' : 'var(--border)',
            border: 'none', cursor: 'pointer', position: 'relative',
            transition: 'background 0.2s',
          }}>
            <div style={{
              width: 20, height: 20, borderRadius: '50%', background: '#fff',
              position: 'absolute', top: 3,
              left: reminderEnabled ? 16 : 2,
              transition: 'left 0.2s',
              boxShadow: '0 1px 4px rgba(0,0,0,0.15)',
            }} />
          </button>
        </div>
      </div>

      {/* Stats */}
      <div style={{
        display: 'flex', justifyContent: 'space-around',
        padding: '12px 0', marginBottom: 18,
        borderTop: '1px solid var(--border)',
        borderBottom: '1px solid var(--border)',
      }}>
        {[
          { label: 'Average', value: String(avgRecent), color: 'var(--text)' },
          { label: 'Min', value: String(minRecent), color: 'var(--text-muted)' },
          { label: 'Max', value: String(maxRecent), color: 'var(--water)' },
          { label: 'Goal', value: displayGoalStr, color: 'var(--accent)' },
        ].map(s => (
          <div key={s.label} style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 18, fontWeight: 900, color: s.color, fontFamily: "'Outfit', sans-serif" }}>
              {s.value}
            </div>
            <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.03em', marginTop: 1 }}>
              {s.label}
            </div>
          </div>
        ))}
      </div>

      {/* Change Goal */}
      <button onClick={() => { setCustomGoal(String(Math.round(displayGoal))); setShowGoalModal(true); }} style={{
        width: '100%', padding: '16px', borderRadius: 16, cursor: 'pointer',
        background: 'var(--pill-bg)',
        border: '1px solid var(--border)',
        color: 'var(--text)', fontWeight: 700, fontSize: 14,
        fontFamily: 'inherit',
      }}>
        Change Daily Goal ({unitLabel})
      </button>

      {/* Goal Modal */}
      {showGoalModal && (
        <Portal>
        <div style={{ position: 'absolute', inset: 0, zIndex: 1000, background: 'var(--overlay)', backdropFilter: 'var(--overlay-blur)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }} onClick={() => setShowGoalModal(false)}>
          <div onClick={e => e.stopPropagation()} style={{
            width: '100%', maxWidth: 430, background: 'var(--nav-bg)', backdropFilter: 'blur(32px)',
            borderRadius: '28px 28px 0 0', border: '1px solid var(--border-glass)', borderBottom: 'none',
            padding: '24px 24px 48px', animation: 'slideUp 0.32s cubic-bezier(0.34,1.56,0.64,1)',
          }}>
            <div style={{ width: 44, height: 5, background: 'var(--border)', borderRadius: 99, margin: '0 auto 22px' }} />
            <h3 style={{ fontSize: 19, fontWeight: 800, color: 'var(--text)', margin: '0 0 8px', fontFamily: "'Sora',sans-serif" }}>Daily Hydration Goal</h3>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 18, lineHeight: 1.4 }}>
              Enter your daily water goal in {unitLabel}
            </p>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <input ref={goalRef}
                style={{ ...inputStyle, flex: 1, borderRadius: 16, fontSize: 18, fontWeight: 700, padding: '14px 16px' }}
                type="number" min="0"
                placeholder={`e.g. ${waterUnit === 'ml' ? '2000' : waterUnit === 'cups' ? '8' : '64'}`}
                defaultValue={waterGoal === 128 ? (waterUnit === 'ml' ? 3785 : waterUnit === 'cups' ? 16 : 128) : (waterUnit === 'ml' ? Math.round(waterGoal * 29.5735) : waterUnit === 'cups' ? Math.round(waterGoal / 8) : waterGoal)}
              />
              <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-muted)', flexShrink: 0 }}>
                {unitLabel}
              </span>
            </div>
            <button onClick={() => {
              if (!goalRef.current) return;
              const val = parseFloat(goalRef.current.value);
              if (val > 0) {
                const oz = waterUnit === 'cups' ? val * PER_UNIT : waterUnit === 'ml' ? val / OZ_TO_ML : val;
                setWaterGoal(Math.round(oz));
              }
              setShowGoalModal(false);
            }} style={{
              width: '100%', padding: '16px', borderRadius: 16, border: 'none', cursor: 'pointer',
              background: 'var(--water)', color: '#fff', fontWeight: 700, fontSize: 15,
              marginTop: 18, fontFamily: 'inherit',
            }}>
              Set Goal
            </button>
          </div>
        </div>
        </Portal>
      )}

      <svg style={{ position: 'absolute', width: 0, height: 0 }}>
        <defs>
          <linearGradient id="waterGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="var(--brand-tertiary)" />
            <stop offset="100%" stopColor="var(--brand-secondary)" />
          </linearGradient>
        </defs>
      </svg>
      <style>{`
        @keyframes dropRipple {
          0% { transform: scale(0.5); opacity: 0.5; }
          100% { transform: scale(2.5); opacity: 0; }
        }
        @keyframes confettiFall {
          0% { transform: translateY(-40px) rotate(0deg); opacity: 0; }
          15% { opacity: 1; }
          100% { transform: translateY(100vh) rotate(720deg); opacity: 0; }
        }
        @keyframes popIn {
          0% { transform: scale(0.6); opacity: 0; }
          100% { transform: scale(1); opacity: 1; }
        }
        @keyframes fadeIn {
          0% { opacity: 0; }
          100% { opacity: 1; }
        }
        @keyframes slideUp {
          0% { transform: translateY(100%); }
          100% { transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
