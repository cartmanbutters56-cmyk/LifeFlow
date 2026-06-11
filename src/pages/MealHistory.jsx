import React, { useState, useMemo, useEffect, useRef } from 'react';

function formatDate(dateStr) {
  const d = new Date(dateStr + 'T12:00:00');
  return d.toLocaleDateString('en', { weekday: 'short', month: 'short', day: 'numeric' });
}

function MiniSparkline({ data, color = 'var(--amber)', height = 44 }) {
  if (!data || data.length < 2) return null;
  const max = Math.max(...data, 1);
  const w = data.length * 8;
  const pts = data.map((v, i) => [i * 8 + 4, height - ((v / max) * (height - 12) + 6)]);
  const path = pts.map((p, i) => (i === 0 ? 'M' : 'L') + p[0].toFixed(1) + ',' + p[1].toFixed(1)).join(' ');
  return (
    <svg width="100%" viewBox={`0 0 ${Math.max(w, 60)} ${height}`} preserveAspectRatio="none" style={{ overflow: 'visible' }}>
      <path d={path} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <defs>
        <linearGradient id="sparkFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.15" />
          <stop offset="100%" stopColor={color} stopOpacity="0.01" />
        </linearGradient>
      </defs>
      <path d={`${path} L${pts[pts.length-1][0]},${height} L${pts[0][0]},${height} Z`} fill="url(#sparkFill)" />
    </svg>
  );
}

const PERIODS = [
  { key: 'daily', label: 'Daily' },
  { key: 'weekly', label: 'Weekly' },
  { key: 'monthly', label: 'Monthly' },
];

export default function MealHistory({ store, setActiveTab }) {
  const { meals, calorieGoal } = store;
  const [period, setPeriod] = useState('daily');
  const [mounted, setMounted] = useState(false);
  const [animIdx, setAnimIdx] = useState(0);
  const scrollRef = useRef(null);

  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 80);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    setAnimIdx(0);
    const t = setInterval(() => setAnimIdx(prev => prev + 1), 40);
    return () => clearInterval(t);
  }, [period]);

  const dateKeys = useMemo(() => Object.keys(meals).sort().reverse(), [meals]);

  const dailyData = useMemo(() => {
    return dateKeys.map(dk => {
      const dayMeals = meals[dk] || [];
      const totalCal = dayMeals.reduce((s, m) => s + (m.calories || 0), 0);
      const doneCal = dayMeals.filter(m => m.done).reduce((s, m) => s + (m.calories || 0), 0);
      const pct = calorieGoal > 0 ? Math.min(Math.round((doneCal / calorieGoal) * 100), 100) : 0;
      return { date: dk, totalCal, doneCal, pct, meals: dayMeals, count: dayMeals.length };
    });
  }, [dateKeys, calorieGoal, meals]);

  const weeklyData = useMemo(() => {
    const weeks = [];
    const sorted = [...dailyData].reverse();
    for (let i = 0; i < sorted.length; i += 7) {
      const chunk = sorted.slice(i, i + 7);
      if (chunk.length === 0) continue;
      const start = chunk[0].date;
      const end = chunk[chunk.length - 1].date;
      const totalCal = chunk.reduce((s, d) => s + d.totalCal, 0);
      const avgCal = Math.round(totalCal / chunk.length);
      const avgPct = Math.round(chunk.reduce((s, d) => s + d.pct, 0) / chunk.length);
      weeks.push({ start, end, avgCal, avgPct, totalCal, days: chunk.length, label: `${formatDate(start)} - ${formatDate(end)}` });
    }
    return weeks;
  }, [dailyData]);

  const monthlyData = useMemo(() => {
    const months = {};
    dailyData.forEach(d => {
      const m = d.date.slice(0, 7);
      if (!months[m]) months[m] = { key: m, totalCal: 0, count: 0, days: [] };
      months[m].totalCal += d.totalCal;
      months[m].count++;
      months[m].days.push(d);
    });
    return Object.values(months).map(m => ({
      ...m,
      avgCal: Math.round(m.totalCal / m.count),
      label: new Date(m.key + '-01').toLocaleDateString('en', { month: 'long', year: 'numeric' }),
      maxDay: Math.max(...m.days.map(d => d.totalCal)),
    }));
  }, [dailyData]);

  const calTrend = useMemo(() => dailyData.slice(0, 30).reverse().map(d => d.totalCal), [dailyData]);

  return (
    <div style={{ padding: '20px 16px 20px', minHeight: '100%', background: 'var(--bg-gradient)' }}>
      {/* Header with back button */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16,
        opacity: mounted ? 1 : 0, transform: mounted ? 'none' : 'translateY(10px)',
        transition: 'all 0.4s cubic-bezier(0.4,0,0.2,1)',
      }}>
        <button
          onClick={() => setActiveTab && setActiveTab('meals')}
          style={{
            width: 36, height: 36, borderRadius: 12,
            background: 'var(--surface)', border: '1px solid var(--border)',
            cursor: 'pointer', display: 'flex', alignItems: 'center',
            justifyContent: 'center', color: 'var(--text)',
          }}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="18" height="18">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
        <div>
          <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.07em', marginBottom: 2 }}>
            HISTORY
          </p>
          <h1 style={{
            fontSize: 24, fontWeight: 800, color: 'var(--text)', margin: 0,
            fontFamily: "'Outfit', sans-serif", letterSpacing: '-0.3px',
          }}>
            Meal History
          </h1>
        </div>
      </div>

      {/* Period Tabs */}
      <div style={{
        display: 'flex', gap: 6, background: 'var(--surface)', padding: 4,
        borderRadius: 14, border: '1px solid var(--border)',
        opacity: mounted ? 1 : 0, transform: mounted ? 'none' : 'translateY(10px)',
        transition: 'all 0.4s cubic-bezier(0.4,0,0.2,1) 0.03s',
      }}>
        {PERIODS.map(p => (
          <button key={p.key} onClick={() => setPeriod(p.key)} style={{
            flex: 1, padding: '8px 6px', borderRadius: 11, fontSize: 12, fontWeight: 700,
            cursor: 'pointer', border: 'none', fontFamily: 'inherit',
            background: period === p.key ? 'var(--accent)' : 'transparent',
            color: period === p.key ? '#fff' : 'var(--text-muted)',
            transition: 'all 0.25s cubic-bezier(0.34,1.56,0.64,1)',
          }}>
            {p.label}
          </button>
        ))}
      </div>

      {/* Calorie Sparkline */}
      {calTrend.length >= 2 && (
        <div style={{
          marginTop: 16, padding: '16px 18px',
          background: 'var(--surface)', borderRadius: 16,
          border: '1px solid var(--border)',
          opacity: mounted ? 1 : 0, transform: mounted ? 'none' : 'translateY(10px)',
          transition: 'all 0.4s cubic-bezier(0.4,0,0.2,1) 0.06s',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--text)', fontFamily: "'Outfit', sans-serif" }}>
                Calorie Trend
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Last 30 days</div>
            </div>
            <div style={{ display: 'flex', gap: 12 }}>
              {[
                { label: 'Min', value: Math.min(...calTrend), color: 'var(--text-muted)' },
                { label: 'Avg', value: Math.round(calTrend.reduce((s, v) => s + v, 0) / calTrend.length), color: 'var(--amber)' },
                { label: 'Max', value: Math.max(...calTrend), color: 'var(--coral)' },
              ].map(s => (
                <div key={s.label} style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 13, fontWeight: 800, color: s.color, fontFamily: "'Outfit', sans-serif" }}>
                    {s.value}
                  </div>
                  <div style={{ fontSize: 9, fontWeight: 600, color: 'var(--text-muted)' }}>
                    {s.label}
                  </div>
                </div>
              ))}
            </div>
          </div>
          <MiniSparkline data={calTrend} color="var(--amber)" />
        </div>
      )}

      {/* Daily View */}
      {period === 'daily' && (
        <div style={{
          marginTop: 16,
          opacity: mounted ? 1 : 0, transform: mounted ? 'none' : 'translateY(10px)',
          transition: 'all 0.4s cubic-bezier(0.4,0,0.2,1) 0.09s',
        }}>
          {dailyData.length === 0 ? (
            <div style={{
              textAlign: 'center', padding: '48px 24px',
              background: 'var(--surface)', borderRadius: 16,
              border: '1px dashed var(--border2)',
            }}>
              <div style={{
                width: 48, height: 48, borderRadius: 16,
                background: 'var(--accent-soft)', display: 'flex',
                alignItems: 'center', justifyContent: 'center',
                fontSize: 24, margin: '0 auto 12px',
              }}>
                📅
              </div>
              <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>No meal history yet</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
                Start logging meals to see your history
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {dailyData.slice(0, 20).map((d, i) => {
                const show = i < animIdx;
                return (
                  <div
                    key={d.date}
                    style={{
                      padding: '14px 16px',
                      background: 'var(--card)',
                      borderRadius: 14,
                      border: '1px solid var(--border)',
                      opacity: show ? 1 : 0,
                      transform: show ? 'none' : 'translateY(8px)',
                      transition: 'all 0.3s ease',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>
                        {formatDate(d.date)}
                      </div>
                      <div style={{
                        fontSize: 13, fontWeight: 800, color: d.pct >= 80 ? 'var(--green)' : d.pct >= 50 ? 'var(--amber)' : 'var(--coral)',
                        fontFamily: "'Outfit', sans-serif",
                      }}>
                        {d.totalCal} kcal
                      </div>
                    </div>
                    <div style={{ width: '100%', height: 4, background: 'var(--border)', borderRadius: 99, marginBottom: 10 }}>
                      <div style={{
                        height: '100%', width: `${d.pct}%`,
                        background: d.pct >= 80 ? 'var(--green)' : d.pct >= 50 ? 'var(--amber)' : 'var(--coral)',
                        borderRadius: 99,
                        transition: 'width 0.6s cubic-bezier(0.4,0,0.2,1)',
                      }} />
                    </div>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {d.meals.slice(0, 5).map(m => (
                        <span key={m.id} style={{
                          fontSize: 11, padding: '4px 10px', borderRadius: 8,
                          background: 'var(--accent-soft)', color: 'var(--text2)', fontWeight: 600,
                        }}>
                          {m.name} {m.calories ? `· ${m.calories}` : ''}
                        </span>
                      ))}
                      {d.meals.length > 5 && (
                        <span style={{
                          fontSize: 11, padding: '4px 10px', borderRadius: 8,
                          background: 'var(--border)', color: 'var(--text-muted)', fontWeight: 600,
                        }}>
                          +{d.meals.length - 5}
                        </span>
                      )}
                    </div>
                    {d.count > 0 && (
                      <div style={{ marginTop: 8, display: 'flex', gap: 6 }}>
                        {['Breakfast', 'Lunch', 'Dinner', 'Snack'].map(slot => {
                          const count = d.meals.filter(m => m.slot === slot).length;
                          if (!count) return null;
                          return (
                            <span key={slot} style={{
                              fontSize: 9, fontWeight: 700, color: 'var(--text-muted)',
                              padding: '2px 8px', borderRadius: 4,
                              background: 'var(--border)',
                            }}>
                              {slot === 'Snack' ? 'Snacks' : slot} {count}
                            </span>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Weekly View */}
      {period === 'weekly' && (
        <div style={{
          marginTop: 16,
          opacity: mounted ? 1 : 0, transform: mounted ? 'none' : 'translateY(10px)',
          transition: 'all 0.4s cubic-bezier(0.4,0,0.2,1) 0.09s',
        }}>
          {weeklyData.length === 0 ? (
            <div style={{
              textAlign: 'center', padding: '48px 24px',
              background: 'var(--surface)', borderRadius: 16,
              border: '1px dashed var(--border2)',
            }}>
              <div style={{
                width: 48, height: 48, borderRadius: 16,
                background: 'var(--accent-soft)', display: 'flex',
                alignItems: 'center', justifyContent: 'center',
                fontSize: 24, margin: '0 auto 12px',
              }}>
                📊
              </div>
              <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>No weekly data</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
                Log meals consistently to see weekly reports
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {weeklyData.slice(0, 12).map((w, i) => {
                const show = i < animIdx;
                return (
                  <div
                    key={i}
                    style={{
                      padding: '16px 18px',
                      background: 'var(--card)',
                      borderRadius: 14,
                      border: '1px solid var(--border)',
                      opacity: show ? 1 : 0,
                      transform: show ? 'none' : 'translateY(8px)',
                      transition: 'all 0.3s ease',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)' }}>
                        Week {weeklyData.length - i}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                        {w.label}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 22, fontWeight: 900, color: 'var(--amber)', fontFamily: "'Outfit', sans-serif" }}>
                          {w.avgCal}
                        </div>
                        <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 600 }}>Avg daily</div>
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 22, fontWeight: 900, color: w.avgPct >= 80 ? 'var(--green)' : w.avgPct >= 50 ? 'var(--amber)' : 'var(--coral)', fontFamily: "'Outfit', sans-serif" }}>
                          {w.avgPct}%
                        </div>
                        <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 600 }}>Avg of goal</div>
                      </div>
                      <div style={{ flex: 1, textAlign: 'right' }}>
                        <div style={{ fontSize: 22, fontWeight: 900, color: 'var(--text)', fontFamily: "'Outfit', sans-serif" }}>
                          {w.totalCal}
                        </div>
                        <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 600 }}>Total</div>
                      </div>
                    </div>
                    <div style={{ marginTop: 10, display: 'flex', gap: 3 }}>
                      {Array.from({ length: w.days }).map((_, di) => (
                        <div key={di} style={{
                          flex: 1, height: 4, borderRadius: 99,
                          background: 'var(--green)',
                          opacity: 0.25 + (di / Math.max(w.days - 1, 1)) * 0.75,
                        }} />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Monthly View */}
      {period === 'monthly' && (
        <div style={{
          marginTop: 16,
          opacity: mounted ? 1 : 0, transform: mounted ? 'none' : 'translateY(10px)',
          transition: 'all 0.4s cubic-bezier(0.4,0,0.2,1) 0.09s',
        }}>
          {monthlyData.length === 0 ? (
            <div style={{
              textAlign: 'center', padding: '48px 24px',
              background: 'var(--surface)', borderRadius: 16,
              border: '1px dashed var(--border2)',
            }}>
              <div style={{
                width: 48, height: 48, borderRadius: 16,
                background: 'var(--accent-soft)', display: 'flex',
                alignItems: 'center', justifyContent: 'center',
                fontSize: 24, margin: '0 auto 12px',
              }}>
                📈
              </div>
              <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>No monthly data</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
                Log meals for a full month to see monthly reports
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {monthlyData.slice(0, 12).map((m, i) => {
                const show = i < animIdx;
                return (
                  <div
                    key={m.key}
                    style={{
                      padding: '16px 18px',
                      background: 'var(--card)',
                      borderRadius: 14,
                      border: '1px solid var(--border)',
                      opacity: show ? 1 : 0,
                      transform: show ? 'none' : 'translateY(8px)',
                      transition: 'all 0.3s ease',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', fontFamily: "'Outfit', sans-serif" }}>
                        {m.label}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                        {m.count} days
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 20, alignItems: 'center' }}>
                      <div>
                        <div style={{ fontSize: 26, fontWeight: 900, color: 'var(--amber)', fontFamily: "'Outfit', sans-serif" }}>
                          {m.avgCal}
                        </div>
                        <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 600 }}>Avg daily</div>
                      </div>
                      <div>
                        <div style={{ fontSize: 26, fontWeight: 900, color: 'var(--text)', fontFamily: "'Outfit', sans-serif" }}>
                          {m.totalCal}
                        </div>
                        <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 600 }}>Total kcal</div>
                      </div>
                      <div>
                        <div style={{ fontSize: 26, fontWeight: 900, color: 'var(--coral)', fontFamily: "'Outfit', sans-serif" }}>
                          {m.maxDay}
                        </div>
                        <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 600 }}>Best day</div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
