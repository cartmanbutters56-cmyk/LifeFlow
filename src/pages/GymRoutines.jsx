import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { inputStyle, PillButton, Modal, Portal } from '../components/UI';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

const EXERCISE_CATEGORIES = [
  { name: 'Chest',     color: '#EF4444', bg: '#FEF2F2', icon: '🫁' },
  { name: 'Back',      color: '#8B5CF6', bg: '#F5F3FF', icon: 'Back' },
  { name: 'Legs',      color: '#06B6D4', bg: '#ECFEFF', icon: '🦵' },
  { name: 'Shoulders', color: '#F59E0B', bg: '#FFFBEB', icon: '💪' },
  { name: 'Arms',      color: '#10B981', bg: '#ECFDF5', icon: '💪' },
  { name: 'Core',      color: '#EC4899', bg: '#FDF2F8', icon: '⚡' },
  { name: 'Cardio',    color: '#F97316', bg: '#FFF7ED', icon: '🏃' },
  { name: 'Rest',      color: '#64748B', bg: '#F8FAFC', icon: '😴' },
];


// Unit type options for custom exercises
const UNIT_TYPES = [
  { id: 'sets_reps', label: 'Sets & Reps', v1Label: 'SETS', v2Label: 'REPS' },
  { id: 'mins',      label: 'Duration',    v1Label: 'MINS', v2Label: 'SECS' },
  { id: 'distance',  label: 'Distance',    v1Label: 'KM',   v2Label: 'MINS' },
];

function getCategoryMeta(name) {
  return EXERCISE_CATEGORIES.find(c => c.name === name);
}

function getUnitLabels(category, unitType) {
  if (unitType) {
    const ut = UNIT_TYPES.find(u => u.id === unitType);
    if (ut) return { v1: ut.v1Label, v2: ut.v2Label };
  }
  if (category === 'Cardio') return { v1: 'MINS', v2: 'KM' };
  return { v1: 'SETS', v2: 'REPS' };
}

// ─── Main Component ──────────────────────────────────────────────────────────
const DEFAULT_WEEK = DAYS.reduce((acc, day) => ({ ...acc, [day]: { category: '', exercises: [] } }), {});

export default function GymRoutines({ store, user, setActiveTab }) {
  const { gymWeekPlan, setGymWeekPlan } = store;

  const [weekPlan, _setWeekPlan] = useState(() => gymWeekPlan || DEFAULT_WEEK);
  useEffect(() => {
    if (gymWeekPlan) _setWeekPlan(gymWeekPlan);
  }, [gymWeekPlan]);

  const setWeekPlan = useCallback((fn) => {
    _setWeekPlan(prev => {
      const next = typeof fn === 'function' ? fn(prev) : fn;
      setGymWeekPlan(next);
      return next;
    });
  }, [setGymWeekPlan]);

  const [selectedDay, setSelectedDay] = useState(() => {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    return days[new Date().getDay()];
  });

  const [showExercises, setShowExercises] = useState(false);
  const [toast, setToast] = useState(null);
  const [mounted, setMounted] = useState(false);
  const dayListRef = useRef(null);

  useEffect(() => { const t = setTimeout(() => setMounted(true), 80); return () => clearTimeout(t); }, []);

  const anyOverlayOpen = showExercises;
  useEffect(() => {
    const el = document.getElementById('app-content-scroll');
    if (!el) return;
    el.style.overflowY = anyOverlayOpen ? 'hidden' : 'auto';
    return () => { el.style.overflowY = 'auto'; };
  }, [anyOverlayOpen]);

  useEffect(() => {
    if (mounted && dayListRef.current) {
      const idx = DAYS.indexOf(selectedDay);
      const child = dayListRef.current.children[idx];
      if (child) child.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    }
  }, [selectedDay, mounted]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2000);
    return () => clearTimeout(t);
  }, [toast]);

  const handleSetCategory = (day, category) => {
    setWeekPlan(prev => ({ ...prev, [day]: { ...prev[day], category } }));
  };

  const handleAddExercise = (day, exercise, sets, reps, unitType) => {
    setWeekPlan(prev => ({
      ...prev,
      [day]: {
        ...prev[day],
        exercises: [...prev[day].exercises, { name: exercise, sets: sets || '', reps: reps || '', unitType: unitType || null, id: Date.now() }],
      },
    }));
    setToast(`${exercise} added`);
  };

  const handleUpdateExercise = (day, exerciseId, field, value) => {
    setWeekPlan(prev => ({
      ...prev,
      [day]: {
        ...prev[day],
        exercises: prev[day].exercises.map(ex => ex.id === exerciseId ? { ...ex, [field]: value } : ex),
      },
    }));
  };

  const handleDeleteExercise = (day, exerciseId) => {
    setWeekPlan(prev => ({
      ...prev,
      [day]: { ...prev[day], exercises: prev[day].exercises.filter(ex => ex.id !== exerciseId) },
    }));
  };

  const todayName = (() => {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    return days[new Date().getDay()];
  })();

  const dayPlan = weekPlan[selectedDay];
  const selectedCatMeta = getCategoryMeta(dayPlan?.category);
  const totalExercises = DAYS.reduce((sum, d) => sum + weekPlan[d].exercises.length, 0);
  const daysWithPlans = DAYS.filter(d => weekPlan[d].category).length;

  return (
    <div style={{ paddingBottom: 24, minHeight: '100%', background: 'var(--bg-gradient)' }}>

      {/* ── Header ── */}
      <div style={{ padding: '20px 20px 12px', animation: mounted ? 'heroEnter 0.5s cubic-bezier(0.16,1,0.3,1) both' : 'none' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button onClick={() => setActiveTab('gym')} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, display: 'flex', alignItems: 'center' }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--text)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M19 12H5" /><path d="M12 19l-7-7 7-7" />
              </svg>
            </button>
            <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)' }}>Gym Routines</span>
          </div>
          <div style={{
            width: 52, height: 52, borderRadius: 18,
            background: 'linear-gradient(135deg, var(--accent) 0%, #818CF8 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 24, boxShadow: '0 4px 20px rgba(99,102,241,0.35)',
          }}>
            🏋️
          </div>
        </div>
      </div>

      {/* ── Day Selector ── */}
      <div ref={dayListRef} style={{
        display: 'flex', gap: 8, padding: '0 16px 4px',
        overflowX: 'auto', scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch',
      }}>
        {DAYS.map((day, i) => {
          const plan = weekPlan[day];
          const isToday = day === todayName;
          const isSelected = day === selectedDay;
          const catMeta = getCategoryMeta(plan.category);
          const exCount = plan.exercises.length;
          const accentColor = catMeta ? catMeta.color : 'var(--accent)';

          return (
            <button
              key={day}
              onClick={() => setSelectedDay(day)}
              style={{
                flex: '0 0 auto', minWidth: 68, padding: '10px 6px 9px',
                borderRadius: 18,
                background: isSelected
                  ? (catMeta ? `linear-gradient(145deg, ${accentColor}, ${accentColor}CC)` : 'var(--accent)')
                  : isToday ? 'var(--accent-soft)' : 'var(--surface)',
                border: `1.5px solid ${isSelected ? 'transparent' : isToday ? 'var(--accent)' : 'var(--border)'}`,
                cursor: 'pointer', fontFamily: 'inherit', textAlign: 'center',
                transition: 'all 0.22s cubic-bezier(0.34,1.56,0.64,1)',
                boxShadow: isSelected ? `0 6px 20px ${accentColor}44` : 'none',
                opacity: mounted ? 1 : 0,
                animation: `fadeUp 0.3s ease ${i * 0.04}s both`,
              }}
            >
              <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.06em', color: isSelected ? '#fff' : isToday ? 'var(--accent)' : 'var(--text-muted)', marginBottom: 3 }}>
                {day.slice(0, 3).toUpperCase()}
              </div>
              {catMeta && !isSelected && (
                <div style={{ width: 6, height: 6, borderRadius: 99, background: catMeta.color, margin: '0 auto 2px' }} />
              )}
              {exCount > 0 && (
                <div style={{ fontSize: 9, fontWeight: 700, color: isSelected ? 'rgba(255,255,255,0.75)' : 'var(--text-muted)' }}>
                  {exCount}×
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* ── Day Detail ── */}
      <div style={{ padding: '14px 16px 20px' }}>

        {/* Day header row */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          marginBottom: 16, padding: '14px 16px',
          borderRadius: 20, background: 'var(--surface)', border: '1px solid var(--border)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {selectedCatMeta && (
              <div style={{
                width: 40, height: 40, borderRadius: 13, background: selectedCatMeta.bg,
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18,
                border: `1.5px solid ${selectedCatMeta.color}33`,
              }}>
                {selectedCatMeta.icon}
              </div>
            )}
            <div>
              <h2 style={{ fontSize: 17, fontWeight: 800, color: 'var(--text)', margin: 0 }}>{selectedDay}</h2>
              {selectedCatMeta
                ? <div style={{ fontSize: 12, fontWeight: 700, color: selectedCatMeta.color, marginTop: 1 }}>{selectedCatMeta.name}</div>
                : <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 1 }}>Tap to plan</div>
              }
            </div>
          </div>
          <button
            onClick={() => setShowExercises(true)}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '9px 16px', borderRadius: 12,
              background: selectedCatMeta ? selectedCatMeta.color : 'var(--accent)',
              color: '#fff', border: 'none', cursor: 'pointer',
              fontSize: 13, fontWeight: 700, fontFamily: 'inherit',
              boxShadow: `0 4px 14px ${selectedCatMeta ? selectedCatMeta.color + '55' : 'rgba(99,102,241,0.35)'}`,
              transition: 'all 0.2s',
            }}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="13" height="13">
              <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            {dayPlan?.category ? 'Edit' : 'Plan'}
          </button>
        </div>

        {/* Exercise List */}
        {dayPlan?.exercises.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {dayPlan.exercises.map((ex, i) => (
              <ExerciseCard
                key={ex.id}
                exercise={ex}
                category={dayPlan.category}
                categoryMeta={selectedCatMeta}
                index={i}
                onUpdate={(field, value) => handleUpdateExercise(selectedDay, ex.id, field, value)}
                onDelete={() => handleDeleteExercise(selectedDay, ex.id)}
              />
            ))}
          </div>
        ) : (
          <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            padding: '52px 24px', borderRadius: 22,
            background: 'var(--surface)', border: '1.5px dashed var(--border2)',
          }}>
            <div style={{
              width: 60, height: 60, borderRadius: 22,
              background: selectedCatMeta ? selectedCatMeta.bg : 'var(--accent-soft)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 26, marginBottom: 14,
              border: `1.5px solid ${selectedCatMeta ? selectedCatMeta.color + '33' : 'var(--border)'}`,
            }}>
              {selectedCatMeta ? selectedCatMeta.icon : '📋'}
            </div>
            <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text)', marginBottom: 5 }}>
              {selectedCatMeta ? 'No exercises yet' : 'Nothing planned'}
            </div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', textAlign: 'center', marginBottom: 18, lineHeight: 1.5 }}>
              {selectedCatMeta ? 'Add exercises to build your routine' : 'Set a category to get started'}
            </div>
            <button
              onClick={() => setShowExercises(true)}
              style={{
                padding: '10px 22px', borderRadius: 12,
                background: selectedCatMeta ? selectedCatMeta.color : 'var(--accent)',
                color: '#fff', border: 'none', cursor: 'pointer',
                fontSize: 13, fontWeight: 700, fontFamily: 'inherit',
              }}
            >
              {selectedCatMeta ? 'Add Exercises' : 'Plan This Day'}
            </button>
          </div>
        )}

        {/* Quick stats */}
        {totalExercises > 0 && (
          <div style={{
            display: 'flex', gap: 10, marginTop: 18,
            padding: '16px', borderRadius: 18,
            background: 'var(--surface)', border: '1px solid var(--border)',
          }}>
            {[
              { label: 'Total Exercises', value: totalExercises, color: 'var(--accent)' },
              { label: 'Days Active',     value: daysWithPlans,  color: '#10B981' },
              { label: 'Today\'s Count',  value: dayPlan?.exercises.length || 0, color: '#F59E0B' },
            ].map((stat, i) => (
              <div key={i} style={{ flex: 1, textAlign: 'center', padding: '4px 0' }}>
                <div style={{ fontSize: 22, fontWeight: 900, color: stat.color, lineHeight: 1 }}>{stat.value}</div>
                <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', marginTop: 4, letterSpacing: '0.03em' }}>{stat.label}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Exercise Selection Modal */}
      {showExercises && selectedDay && (
        <ExerciseModal
          day={selectedDay}
          weekPlan={weekPlan}
          onSetCategory={handleSetCategory}
          onAddExercise={handleAddExercise}
          onClose={() => setShowExercises(false)}
        />
      )}

      {/* Toast */}
      {toast && createPortal(
        <div style={{ position: 'absolute', bottom: 100, left: 0, right: 0, display: 'flex', justifyContent: 'center', pointerEvents: 'none', zIndex: 1100 }}>
          <div style={{
            background: '#10B981', color: '#fff', padding: '10px 22px',
            borderRadius: 14, fontSize: 13, fontWeight: 700,
            boxShadow: '0 8px 32px rgba(16,185,129,0.3)',
            animation: 'popIn 0.25s cubic-bezier(0.34,1.56,0.64,1)',
            display: 'flex', alignItems: 'center', gap: 7,
          }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="14" height="14">
              <polyline points="20 6 9 17 4 12" />
            </svg>
            {toast}
          </div>
        </div>,
        document.getElementById('toast-root')
      )}
    </div>
  );
}

// ─── Exercise Card ────────────────────────────────────────────────────────────
function ExerciseCard({ exercise, category, categoryMeta, index, onUpdate, onDelete }) {
  const [editing, setEditing] = useState(false);
  const [v1, setV1] = useState(exercise.sets);
  const [v2, setV2] = useState(exercise.reps);

  useEffect(() => { setV1(exercise.sets); setV2(exercise.reps); }, [exercise.sets, exercise.reps]);

  const units = getUnitLabels(category, exercise.unitType);

  const handleSave = () => {
    onUpdate('sets', v1);
    onUpdate('reps', v2);
    setEditing(false);
  };

  const accentColor = categoryMeta?.color || 'var(--accent)';
  const accentBg    = categoryMeta?.bg    || 'var(--accent-soft)';

  return (
    <div style={{
      background: 'var(--card)', borderRadius: 18, border: '1px solid var(--border)',
      overflow: 'hidden', animation: `fadeUp 0.25s ease ${index * 0.04}s both`,
      transition: 'box-shadow 0.2s',
      boxShadow: editing ? '0 4px 24px rgba(0,0,0,0.08)' : 'none',
    }}>
      {/* Left accent bar */}
      <div style={{ position: 'relative' }}>
        <div style={{
          position: 'absolute', left: 0, top: 0, bottom: 0,
          width: 4, borderRadius: '0 0 0 0',
          background: accentColor, opacity: 0.85,
        }} />
        <div
          onClick={() => setEditing(e => !e)}
          style={{ padding: '13px 14px 13px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
        >
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>{exercise.name}</div>
            {(exercise.sets || exercise.reps) && (
              <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, marginTop: 2 }}>
                {[exercise.sets && `${exercise.sets} ${units.v1.toLowerCase()}`, exercise.reps && `${exercise.reps} ${units.v2.toLowerCase()}`]
                  .filter(Boolean).join(' · ')}
              </div>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{
              fontSize: 10, fontWeight: 700,
              color: editing ? accentColor : 'var(--text-muted)',
              background: editing ? accentBg : 'var(--surface)',
              padding: '3px 9px', borderRadius: 99, transition: 'all 0.2s',
              border: `1px solid ${editing ? accentColor + '40' : 'var(--border)'}`,
            }}>
              {editing ? 'editing' : 'edit'}
            </div>
            <button
              onClick={(e) => { e.stopPropagation(); onDelete(); }}
              style={{
                padding: 7, borderRadius: 10, background: '#FEF2F2', border: 'none',
                cursor: 'pointer', color: '#EF4444', display: 'flex', lineHeight: 1,
              }}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="13" height="13">
                <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {editing && (
        <div style={{ padding: '0 16px 14px', borderTop: '1px solid var(--border)', background: 'var(--surface)' }}>
          <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
            {[{ label: units.v1, val: v1, set: setV1 }, { label: units.v2, val: v2, set: setV2 }].map(({ label, val, set }) => (
              <div key={label} style={{ flex: 1 }}>
                <div style={{ fontSize: 10, fontWeight: 800, color: accentColor, marginBottom: 5, letterSpacing: '0.06em' }}>{label}</div>
                <input
                  type="number" placeholder="0" value={val}
                  onChange={(e) => set(e.target.value)}
                  style={{ ...inputStyle, textAlign: 'center', fontSize: 15, fontWeight: 700 }}
                />
              </div>
            ))}
          </div>
          <button
            onClick={handleSave}
            style={{
              width: '100%', marginTop: 10, padding: '11px', borderRadius: 12,
              background: accentColor, color: '#fff', border: 'none',
              fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
            }}
          >
            Save
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Exercise Modal ───────────────────────────────────────────────────────────
function ExerciseModal({ day, weekPlan, onSetCategory, onAddExercise, onClose }) {
  // Custom exercise state
  const [customName, setCustomName] = useState('');
  const [customUnitType, setCustomUnitType] = useState(null); // null = not yet chosen
  const [customStep, setCustomStep] = useState('name'); // 'name' | 'unit' | 'values'
  const [customV1, setCustomV1] = useState('');
  const [customV2, setCustomV2] = useState('');

  const currentCategory = weekPlan[day]?.category;
  const isCardio = currentCategory === 'Cardio';
  const units = getUnitLabels(currentCategory, null);

  // ── Custom exercise handlers ──
  const handleCustomNameNext = () => {
    if (!customName.trim()) return;
    setCustomStep('unit');
    setCustomUnitType(null);
    setCustomV1('');
    setCustomV2('');
  };

  const handleSelectUnitType = (typeId) => {
    setCustomUnitType(typeId);
    setCustomStep('values');
    setCustomV1('');
    setCustomV2('');
  };

  const handleConfirmCustom = () => {
    if (!customName.trim() || !customUnitType) return;
    onAddExercise(day, customName.trim(), customV1, customV2, customUnitType);
    setCustomName('');
    setCustomUnitType(null);
    setCustomStep('name');
    setCustomV1('');
    setCustomV2('');
  };

  const handleResetCustom = () => {
    setCustomStep('name');
    setCustomUnitType(null);
    setCustomV1('');
    setCustomV2('');
  };

  const customUnitMeta = UNIT_TYPES.find(u => u.id === customUnitType);

  return (
    <Portal>
      <div
        style={{
          position: 'absolute', inset: 0, zIndex: 1000,
          background: 'var(--overlay)', backdropFilter: 'var(--overlay-blur)',
          display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
        }}
        onClick={onClose}
      >
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            width: '100%', maxWidth: 430,
            background: 'var(--nav-bg)', backdropFilter: 'blur(32px)',
            borderRadius: '28px 28px 0 0',
            border: '1px solid var(--border-glass)', borderBottom: 'none',
            padding: '20px 20px 48px',
            animation: 'slideUp 0.32s cubic-bezier(0.34,1.56,0.64,1)',
            maxHeight: '88vh', overflowY: 'auto',
          }}
        >
          {/* Handle */}
          <div style={{ width: 40, height: 4, background: 'var(--border)', borderRadius: 99, margin: '0 auto 20px' }} />

          {/* Modal title */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
            {getCategoryMeta(weekPlan[day]?.category) && (
              <div style={{
                width: 38, height: 38, borderRadius: 12,
                background: getCategoryMeta(weekPlan[day]?.category)?.bg,
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18,
              }}>
                {getCategoryMeta(weekPlan[day]?.category)?.icon}
              </div>
            )}
            <div>
              <h3 style={{ fontSize: 18, fontWeight: 900, color: 'var(--text)', margin: 0, lineHeight: 1.1 }}>{day}</h3>
              <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0, marginTop: 2 }}>Set category · add exercises</p>
            </div>
          </div>

          {/* ── Category Grid ── */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--text-muted)', marginBottom: 10, letterSpacing: '0.08em' }}>CATEGORY</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 7 }}>
              {EXERCISE_CATEGORIES.map((cat) => {
                const isActive = weekPlan[day].category === cat.name;
                return (
                  <button
                    key={cat.name}
                    onClick={() => {
                      onSetCategory(day, cat.name);
                      handleResetCustom();
                    }}
                    style={{
                      padding: '10px 4px 8px', borderRadius: 14,
                      border: `1.5px solid ${isActive ? cat.color : 'var(--border)'}`,
                      background: isActive ? cat.bg : 'var(--glass-bg)',
                      color: isActive ? cat.color : 'var(--text)',
                      fontWeight: 700, fontSize: 11, cursor: 'pointer', fontFamily: 'inherit',
                      transition: 'all 0.18s', textAlign: 'center',
                      boxShadow: isActive ? `0 2px 12px ${cat.color}30` : 'none',
                    }}
                  >
                    {cat.name}
                  </button>
                );
              })}
            </div>
          </div>

          {/* ── Custom Exercise ── */}
          {currentCategory && currentCategory !== 'Rest' && (
            <>
              <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--text-muted)', marginBottom: 10, letterSpacing: '0.08em' }}>ADD EXERCISE</div>

              {/* Step 1: Name */}
              {customStep === 'name' && (
                <div style={{ display: 'flex', gap: 8 }}>
                  <input
                    style={{ ...inputStyle, flex: 1 }}
                    type="text" placeholder="e.g. Battle Ropes"
                    value={customName}
                    onChange={(e) => setCustomName(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleCustomNameNext()}
                  />
                  <button
                    onClick={handleCustomNameNext}
                    disabled={!customName.trim()}
                    style={{
                      padding: '10px 16px', borderRadius: 11,
                      background: customName.trim() ? 'var(--accent)' : 'var(--surface)',
                      color: customName.trim() ? '#fff' : 'var(--text-muted)',
                      border: `1px solid ${customName.trim() ? 'transparent' : 'var(--border)'}`,
                      fontSize: 13, fontWeight: 700, cursor: customName.trim() ? 'pointer' : 'not-allowed',
                      fontFamily: 'inherit', transition: 'all 0.18s',
                    }}
                  >
                    Next →
                  </button>
                </div>
              )}

              {/* Step 2: Choose unit type */}
              {customStep === 'unit' && (
                <div style={{
                  background: 'var(--accent-soft)', border: '1.5px solid var(--accent)',
                  borderRadius: 16, padding: '14px 14px 12px',
                  animation: 'fadeUp 0.2s ease both',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                    <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--accent)' }}>{customName}</div>
                    <button onClick={handleResetCustom} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 11, fontWeight: 700 }}>
                      ← Back
                    </button>
                  </div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 9, letterSpacing: '0.06em' }}>HOW DO YOU TRACK IT?</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                    {UNIT_TYPES.map((ut) => (
                      <button
                        key={ut.id}
                        onClick={() => handleSelectUnitType(ut.id)}
                        style={{
                          padding: '11px 14px', borderRadius: 12,
                          background: 'var(--card)', border: '1.5px solid var(--border)',
                          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                          cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s',
                        }}
                      >
                        <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{ut.label}</span>
                        <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', background: 'var(--surface)', padding: '3px 9px', borderRadius: 99 }}>
                          {ut.v1Label} + {ut.v2Label}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Step 3: Enter values */}
              {customStep === 'values' && customUnitMeta && (
                <div style={{
                  background: 'var(--accent-soft)', border: '1.5px solid var(--accent)',
                  borderRadius: 16, padding: '14px',
                  animation: 'fadeUp 0.2s ease both',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--accent)' }}>{customName}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, marginTop: 1 }}>
                        {customUnitMeta.label} — {customUnitMeta.v1Label} + {customUnitMeta.v2Label}
                      </div>
                    </div>
                    <button
                      onClick={() => setCustomStep('unit')}
                      style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 11, fontWeight: 700 }}
                    >
                      ← Change
                    </button>
                  </div>
                  <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
                    {[{ label: customUnitMeta.v1Label, val: customV1, set: setCustomV1, auto: true }, { label: customUnitMeta.v2Label, val: customV2, set: setCustomV2 }].map(({ label, val, set, auto }) => (
                      <div key={label} style={{ flex: 1 }}>
                        <div style={{ fontSize: 10, fontWeight: 800, color: 'var(--accent)', marginBottom: 4, letterSpacing: '0.06em' }}>{label}</div>
                        <input
                          type="number" placeholder="0" value={val}
                          onChange={(e) => set(e.target.value)}
                          autoFocus={auto}
                          style={{ ...inputStyle, textAlign: 'center', fontWeight: 700 }}
                        />
                      </div>
                    ))}
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      onClick={handleResetCustom}
                      style={{
                        flex: 1, padding: '10px', borderRadius: 10, background: 'transparent',
                        color: 'var(--text-muted)', border: '1px solid var(--border)',
                        fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
                      }}
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleConfirmCustom}
                      style={{
                        flex: 2, padding: '10px', borderRadius: 10,
                        background: 'var(--accent)', color: '#fff', border: 'none',
                        fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
                      }}
                    >
                      Add Exercise
                    </button>
                  </div>
                </div>
              )}
            </>
          )}

          {/* Done button */}
          <button
            onClick={onClose}
            style={{
              width: '100%', padding: '15px', borderRadius: 16,
              background: 'var(--accent)', color: '#fff', border: 'none',
              fontSize: 15, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit',
              marginTop: 22,
              boxShadow: '0 4px 20px rgba(99,102,241,0.35)',
            }}
          >
            Done
          </button>
        </div>
      </div>
    </Portal>
  );
}