import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Portal, ProgressRing } from '../components/UI';
import { FOODS } from './Fooddatabase';
function stringColor(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
  const colors = [
    ['#FF6B6B', '#EE5A24'], ['#FECA57', '#F0932B'], ['#48DBFB', '#0ABDE3'],
    ['#FF9FF3', '#F368E0'], ['#54A0FF', '#2E86DE'], ['#5F27CD', '#341F97'],
    ['#1DD1A1', '#10AC84'], ['#00D2D3', '#01A3A4'], ['#F368E0', '#BE2EDD'],
    ['#FF6348', '#EB3B1A'],
  ];
  return colors[Math.abs(hash) % colors.length];
}

function formatTime(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  const now = new Date();
  const isToday = now.toDateString() === d.toDateString();
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const isYesterday = yesterday.toDateString() === d.toDateString();
  const time = d.toLocaleTimeString('en', { hour: 'numeric', minute: '2-digit' });
  if (isToday) return time;
  if (isYesterday) return 'Yesterday ' + time;
  return d.toLocaleDateString('en', { month: 'short', day: 'numeric' }) + ' ' + time;
}

function ThreeDotMenu({ items }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    const fn = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    if (open) document.addEventListener('mousedown', fn);
    return () => document.removeEventListener('mousedown', fn);
  }, [open]);
  return (
    <div ref={ref} style={{ position: 'relative', flexShrink: 0 }}>
      <button onClick={() => setOpen(v => !v)} style={{
        width: 36, height: 36, borderRadius: 12,
        background: open ? 'var(--accent-soft)' : 'transparent',
        border: '1px solid var(--border)', cursor: 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: 'var(--text-muted)',
      }}>
        <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16">
          <circle cx="12" cy="4" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="12" cy="20" r="2"/>
        </svg>
      </button>
      {open && (
        <div style={{
          position: 'absolute', top: '100%', right: 0, zIndex: 999, minWidth: 170,
          background: 'var(--nav-bg)', backdropFilter: 'blur(24px)',
          border: '1px solid var(--border-glass)', borderRadius: 14, marginTop: 4,
          boxShadow: '0 12px 40px rgba(0,0,0,0.18)', overflow: 'hidden',
          animation: 'fadeUp 0.12s ease',
        }}>
          {items.map((item, i) => (
            <button key={i} onClick={() => { item.action(); setOpen(false); }} style={{
              width: '100%', padding: '11px 14px', border: 'none', cursor: 'pointer',
              background: 'transparent', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 10,
              fontSize: 13, fontWeight: 600, color: item.danger ? 'var(--coral)' : 'var(--text)',
              fontFamily: 'inherit',
              borderBottom: i < items.length - 1 ? '1px solid var(--border)' : 'none',
            }}>
              <span style={{ fontSize: 15, width: 20, textAlign: 'center' }}>{item.icon}</span>
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function EmptyState({ onScan }) {
  return (
    <div style={{
      textAlign: 'center', padding: '48px 32px',
      borderRadius: 20, border: '1px dashed var(--border2)',
      background: 'transparent',
    }}>
      <div style={{
        width: 64, height: 64, borderRadius: 20,
        background: 'var(--accent-soft)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 28, margin: '0 auto 16px',
      }}>
        🍽
      </div>
      <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)', marginBottom: 6 }}>
        No meals logged today
      </div>
      <div style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.5, marginBottom: 20 }}>
        Tap the + button to add a meal or use the camera to scan your food
      </div>
      {onScan && (
        <button onClick={onScan} style={{
          padding: '11px 22px', borderRadius: 12,
          background: 'var(--accent)', border: 'none',
          color: '#fff', fontSize: 13, fontWeight: 700,
          cursor: 'pointer', fontFamily: 'inherit',
          display: 'inline-flex', alignItems: 'center', gap: 8,
        }}>
          Scan Food
        </button>
      )}
    </div>
  );
}

function FoodCard({ meal, onDelete }) {
  const [c1, c2] = stringColor(meal.name || 'Food');
  const letter = (meal.name?.[0] || '?').toUpperCase();
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12,
      padding: '12px 14px',
      background: 'var(--card)',
      borderRadius: 16,
      border: '1px solid var(--border)',
      animation: 'fadeUp 0.25s ease',
    }}>
      <div style={{
        width: 44, height: 44, borderRadius: 14, flexShrink: 0,
        background: `linear-gradient(135deg, ${c1}, ${c2})`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 18, fontWeight: 800, color: '#fff',
      }}>
        {letter}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {meal.name}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
            {meal.serving || '1 serving'}
          </span>
          {meal.createdAt && (
            <>
              <span style={{ fontSize: 10, color: 'var(--border2)' }}>·</span>
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                {formatTime(meal.createdAt)}
              </span>
            </>
          )}
        </div>
      </div>
      <div style={{ textAlign: 'right', flexShrink: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text)', fontFamily: "'Outfit', sans-serif", lineHeight: 1 }}>
            {meal.calories || 0}
          </div>
          <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
            cal
          </div>
        </div>
        <button onClick={() => onDelete(meal.id)} style={{
          padding: 4, borderRadius: 6, background: 'transparent',
          border: 'none', cursor: 'pointer', color: 'var(--text-muted)', opacity: 0.4,
          display: 'flex', lineHeight: 1,
        }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14">
            <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
          </svg>
        </button>
      </div>
    </div>
  );
}

export default function MealPlanner({ store, setActiveTab }) {
  const { getTodayMeals, addMeal, deleteMeal, calorieGoal, setCalorieGoal } = store;
  const [showGoal, setShowGoal] = useState(false);
  const [goalInput, setGoalInput] = useState(String(calorieGoal));
  const [mounted, setMounted] = useState(false);
  const [showAdd, setShowAdd] = useState(false);

  const [foodName, setFoodName] = useState('');
  const [foodCals, setFoodCals] = useState('');
  const [foodQty, setFoodQty] = useState(1);
  const [selectedBase, setSelectedBase] = useState(null);
  const [manualCal, setManualCal] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef(null);
  const suggestRef = useRef(null);

  useEffect(() => { const t = setTimeout(() => setMounted(true), 80); return () => clearTimeout(t); }, []);

  useEffect(() => {
    if (showAdd && inputRef.current) inputRef.current.focus();
  }, [showAdd]);

  useEffect(() => {
    if (selectedBase && !manualCal) {
      setFoodCals(String(selectedBase.cal * foodQty));
    }
  }, [foodQty, selectedBase, manualCal]);

  const suggestions = useMemo(() => {
    if (!foodName.trim() || foodName.length < 1) return [];
    const q = foodName.toLowerCase();
    return FOODS.filter(f => f.name.toLowerCase().includes(q)).slice(0, 8);
  }, [foodName]);

  useEffect(() => {
    setSelectedIndex(0);
    setShowSuggestions(suggestions.length > 0);
  }, [suggestions]);

  const selectFood = (food) => {
    setSelectedBase(food);
    setFoodName(food.name);
    setFoodQty(1);
    setFoodCals(String(food.cal));
    setManualCal(false);
    setShowSuggestions(false);
  };

  const handleKeyDown = (e) => {
    if (!showSuggestions) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setSelectedIndex(i => Math.min(i + 1, suggestions.length - 1)); }
    if (e.key === 'ArrowUp') { e.preventDefault(); setSelectedIndex(i => Math.max(i - 1, 0)); }
    if (e.key === 'Enter' && showSuggestions) { e.preventDefault(); selectFood(suggestions[selectedIndex]); }
    if (e.key === 'Escape') setShowSuggestions(false);
  };

  const handleAdd = () => {
    if (!foodName.trim()) return;
    addMeal({ name: foodName.trim(), calories: parseInt(foodCals) || 0 });
    setFoodName(''); setFoodCals(''); setFoodQty(1);
    setSelectedBase(null); setManualCal(false);
    setShowAdd(false);
  };

  const anyOverlayOpen = showGoal || showAdd;
  useEffect(() => {
    const el = document.getElementById('app-content-scroll');
    if (!el) return;
    el.style.overflowY = anyOverlayOpen ? 'hidden' : 'auto';
    return () => { el.style.overflowY = 'auto'; };
  }, [anyOverlayOpen]);

  const meals = getTodayMeals().sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
  const totalCals = meals.filter(m => m.calories).reduce((s, m) => s + m.calories, 0);
  const calPct = calorieGoal > 0 ? Math.min((totalCals / calorieGoal) * 100, 100) : 0;
  const remaining = Math.max(calorieGoal - totalCals, 0);
  const isOverLimit = totalCals > calorieGoal;
  const calColor = isOverLimit ? 'var(--coral)' : calPct >= 90 ? 'var(--amber)' : 'var(--green)';

  return (
    <div style={{ padding: '20px 16px 20px', minHeight: '100%', background: 'var(--bg-gradient)', position: 'relative' }}>
      {/* Header */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
        opacity: mounted ? 1 : 0, transform: mounted ? 'none' : 'translateY(14px)',
        transition: 'all 0.4s cubic-bezier(0.4,0,0.2,1)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={() => setActiveTab('gym')} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, display: 'flex', alignItems: 'center' }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--text)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 12H5" /><path d="M12 19l-7-7 7-7" />
            </svg>
          </button>
          <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)' }}>Meal Tracker</span>
        </div>
        <ThreeDotMenu
          items={[
            { label: 'Meal History', icon: '📅', action: () => setActiveTab && setActiveTab('mealhistory') },
            { label: 'Edit Goal', icon: '🎯', action: () => { setGoalInput(String(calorieGoal)); setShowGoal(true); } },
          ]}
        />
      </div>

      {/* Progress Ring Summary */}
      <div style={{
        marginTop: 16, marginBottom: 20,
        padding: '16px 18px',
        background: 'var(--surface)',
        borderRadius: 20,
        border: '1px solid var(--border)',
        opacity: mounted ? 1 : 0, transform: mounted ? 'none' : 'translateY(14px)',
        transition: 'all 0.4s cubic-bezier(0.4,0,0.2,1) 0.03s',
        display: 'flex', alignItems: 'center', gap: 16,
      }}>
        <ProgressRing pct={calPct} size={72} stroke={6} color={calColor}
          label={`${Math.round(calPct)}%`}
        />
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 4 }}>
            <span style={{ fontSize: 28, fontWeight: 900, color: calColor, fontFamily: "'Outfit', sans-serif", lineHeight: 1 }}>
              {totalCals}
            </span>
            <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>/ {calorieGoal}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
              calories
            </span>
            <span style={{ fontSize: 11, fontWeight: 600, color: isOverLimit ? 'var(--coral)' : 'var(--green)' }}>
              {isOverLimit ? `${totalCals - calorieGoal} over` : `${remaining} left`}
            </span>
            <span style={{ marginLeft: 'auto', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)' }}>
              {meals.length} meal{meals.length !== 1 ? 's' : ''}
            </span>
          </div>
        </div>
      </div>

      {/* Food List */}
      <div style={{
        opacity: mounted ? 1 : 0, transform: mounted ? 'none' : 'translateY(14px)',
        transition: 'all 0.4s cubic-bezier(0.4,0,0.2,1) 0.06s',
      }}>
        {meals.length === 0 ? (
          <EmptyState onScan={() => setShowScanner(true)} />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {meals.map((meal, i) => (
              <div key={meal.id} style={{
                animation: `fadeUp 0.25s ease ${i * 0.03}s both`,
              }}>
                <FoodCard meal={meal} onDelete={deleteMeal} />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add Food Button */}
      <button onClick={() => setShowAdd(true)} style={{
        width: '100%', marginTop: 12,
        padding: '14px 16px', borderRadius: 16,
        border: '1.5px dashed var(--border2)',
        background: 'transparent',
        cursor: 'pointer', fontFamily: 'inherit',
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
        color: 'var(--text-muted)',
        transition: 'all 0.2s ease',
      }}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18">
          <line x1="12" y1="5" x2="12" y2="19" />
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
        <span style={{ fontSize: 13, fontWeight: 700 }}>Add Food</span>
      </button>

      {/* Add Food Modal */}
      {showAdd && (
        <Portal>
          <div style={{ position: 'absolute', inset: 0, zIndex: 1000, background: 'var(--overlay)', backdropFilter: 'var(--overlay-blur)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }} onClick={() => setShowAdd(false)}>
            <div onClick={e => e.stopPropagation()} style={{
              width: '100%', maxWidth: 430, background: 'var(--nav-bg)', backdropFilter: 'blur(32px)',
              borderRadius: '28px 28px 0 0', border: '1px solid var(--border-glass)', borderBottom: 'none',
              padding: '24px 24px 48px', animation: 'slideUp 0.32s cubic-bezier(0.34,1.56,0.64,1)',
            }}>
              <div style={{ width: 44, height: 5, background: 'var(--border)', borderRadius: 99, margin: '0 auto 22px' }} />
              <h3 style={{ fontSize: 18, fontWeight: 800, color: 'var(--text)', margin: '0 0 16px', fontFamily: "'Sora',sans-serif" }}>Add Food</h3>

              <div ref={suggestRef} style={{ position: 'relative', marginBottom: 12 }}>
                <input ref={inputRef}
                  type="text" placeholder="Search food..."
                  value={foodName}
                  onChange={e => { setFoodName(e.target.value); setShowSuggestions(true); setSelectedBase(null); }}
                  onKeyDown={handleKeyDown}
                  style={{
                    width: '100%', padding: '12px 14px', borderRadius: 12,
                    border: '1.5px solid var(--border)', background: 'var(--input-bg)',
                    color: 'var(--text)', fontSize: 14, fontWeight: 600,
                    outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box',
                  }}
                />
                {showSuggestions && (
                  <div style={{
                    position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 100,
                    marginTop: 4, maxHeight: 220, overflowY: 'auto',
                    background: 'var(--nav-bg)', backdropFilter: 'blur(24px)',
                    border: '1px solid var(--border-glass)', borderRadius: 12,
                    boxShadow: '0 12px 40px rgba(0,0,0,0.18)',
                  }}>
                    {suggestions.map((food, i) => (
                      <button key={food.name}
                        onClick={() => selectFood(food)}
                        onMouseEnter={() => setSelectedIndex(i)}
                        style={{
                          width: '100%', padding: '10px 14px', border: 'none', cursor: 'pointer',
                          background: i === selectedIndex ? 'var(--accent-soft)' : 'transparent',
                          textAlign: 'left', display: 'flex', alignItems: 'center', gap: 10,
                          fontSize: 13, fontWeight: 600, color: 'var(--text)', fontFamily: 'inherit',
                          borderBottom: i < suggestions.length - 1 ? '1px solid var(--border)' : 'none',
                        }}
                      >
                        <span style={{ flex: 1 }}>{food.name}</span>
                        <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)' }}>{food.cal} kcal</span>
                        <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>/{food.unit}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {selectedBase && (
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 10, paddingLeft: 2, display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span>1 {selectedBase.unit} = {selectedBase.cal} kcal</span>
                </div>
              )}

              <div style={{ display: 'flex', gap: 10, marginBottom: 16, alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)' }}>Qty</label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 0, border: '1.5px solid var(--border)', borderRadius: 10, overflow: 'hidden', background: 'var(--bg)' }}>
                    <button onClick={() => setFoodQty(q => Math.max(1, q - 1))} style={{
                      padding: '6px 8px', border: 'none', background: 'transparent',
                      cursor: 'pointer', color: 'var(--text)', fontSize: 12, fontWeight: 700,
                      fontFamily: 'inherit', lineHeight: 1,
                    }}>−</button>
                    <input type="number" min="1" step="1" value={foodQty}
                      onChange={e => { const v = parseInt(e.target.value) || 1; setFoodQty(v); if (selectedBase) setManualCal(false); }}
                      style={{
                        width: 44, padding: '6px 2px', border: 'none',
                        borderLeft: '1.5px solid var(--border)', borderRight: '1.5px solid var(--border)',
                        background: 'transparent', color: 'var(--text)', fontSize: 13,
                        fontWeight: 700, textAlign: 'center', outline: 'none', fontFamily: 'inherit',
                      }}
                    />
                    <button onClick={() => setFoodQty(q => q + 1)} style={{
                      padding: '6px 8px', border: 'none', background: 'transparent',
                      cursor: 'pointer', color: 'var(--text)', fontSize: 12, fontWeight: 700,
                      fontFamily: 'inherit', lineHeight: 1,
                    }}>+</button>
                  </div>
                  {selectedBase && (
                    <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>{selectedBase.unit}</span>
                  )}
                </div>
                <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)' }}>Cal</label>
                  <input type="number" placeholder="0" value={foodCals}
                    onChange={e => { setFoodCals(e.target.value); setManualCal(true); }}
                    onKeyDown={e => e.key === 'Enter' && handleAdd()}
                    style={{
                      width: 80, padding: '8px 10px', borderRadius: 10,
                      border: '1.5px solid var(--border)',
                      background: manualCal && selectedBase ? 'var(--amber-soft)' : 'var(--input-bg)',
                      color: 'var(--text)', fontSize: 13, fontWeight: 700, textAlign: 'center',
                      outline: 'none', fontFamily: 'inherit',
                    }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => { setShowAdd(false); setSelectedBase(null); setManualCal(false); setFoodName(''); setFoodCals(''); }} style={{
                  flex: 1, padding: '13px 0', borderRadius: 14,
                  border: '1px solid var(--border)', background: 'transparent',
                  color: 'var(--text-muted)', fontSize: 14, fontWeight: 700,
                  cursor: 'pointer', fontFamily: 'inherit',
                }}>Cancel</button>
                <button onClick={handleAdd} style={{
                  flex: 2, padding: '13px 0', borderRadius: 14, border: 'none',
                  background: foodName.trim() ? 'var(--accent)' : 'var(--border)',
                  color: foodName.trim() ? '#fff' : 'var(--text-muted)',
                  fontSize: 14, fontWeight: 700,
                  cursor: foodName.trim() ? 'pointer' : 'default',
                  fontFamily: 'inherit',
                }}>Add Food</button>
              </div>
            </div>
          </div>
        </Portal>
      )}

      {/* Goal Modal */}
      {showGoal && (
        <Portal>
          <div style={{ position: 'absolute', inset: 0, zIndex: 1000, background: 'var(--overlay)', backdropFilter: 'var(--overlay-blur)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }} onClick={() => setShowGoal(false)}>
            <div onClick={e => e.stopPropagation()} style={{
              width: '100%', maxWidth: 430, background: 'var(--nav-bg)', backdropFilter: 'blur(32px)',
              borderRadius: '28px 28px 0 0', border: '1px solid var(--border-glass)', borderBottom: 'none',
              padding: '24px 24px 48px', animation: 'slideUp 0.32s cubic-bezier(0.34,1.56,0.64,1)',
            }}>
              <div style={{ width: 44, height: 5, background: 'var(--border)', borderRadius: 99, margin: '0 auto 22px' }} />
              <h3 style={{ fontSize: 18, fontWeight: 800, color: 'var(--text)', margin: '0 0 20px', fontFamily: "'Sora',sans-serif" }}>Daily Calorie Goal</h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 14 }}>
                {[1200, 1500, 1800, 2000, 2200, 2500].map(g => (
                  <button key={g} onClick={() => setGoalInput(String(g))} style={{
                    padding: '13px', borderRadius: 14, cursor: 'pointer',
                    border: `1.5px solid ${goalInput === String(g) ? 'var(--accent)' : 'var(--border)'}`,
                    background: goalInput === String(g) ? 'var(--accent-soft)' : 'transparent',
                    color: goalInput === String(g) ? 'var(--accent)' : 'var(--text)', fontWeight: 700, fontSize: 15,
                    fontFamily: 'inherit',
                  }}>{g} kcal</button>
                ))}
              </div>
              <input style={{
                width: '100%', padding: '12px 14px', borderRadius: 14,
                border: '1.5px solid var(--border)', background: 'var(--input-bg)',
                color: 'var(--text)', fontSize: 14, fontWeight: 500, outline: 'none',
                fontFamily: 'inherit', boxSizing: 'border-box',
              }} type="number" placeholder="Custom goal" value={goalInput} onChange={e => setGoalInput(e.target.value)} />
              <button onClick={() => { const g = parseInt(goalInput); if (g > 0) setCalorieGoal(g); setShowGoal(false); }} style={{
                width: '100%', marginTop: 14, padding: '13px', borderRadius: 14, cursor: 'pointer',
                background: 'var(--accent)', border: 'none', color: '#fff', fontSize: 15, fontWeight: 700,
                fontFamily: 'inherit',
              }}>Save Goal</button>
            </div>
          </div>
        </Portal>
      )}
    </div>
  );
}
