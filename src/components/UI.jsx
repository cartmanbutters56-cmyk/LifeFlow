import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

/* ── GlassCard ───────────────────────────────────────────── */
export function GlassCard({ children, style, onClick, className, noHover }) {
  const [pressed, setPressed] = useState(false);
  const [hover, setHover] = useState(false);
  return (
    <div
      className={className}
      onClick={onClick}
      onMouseDown={() => onClick && setPressed(true)}
      onMouseUp={() => setPressed(false)}
      onMouseLeave={() => { setPressed(false); setHover(false); }}
      onMouseEnter={() => onClick && setHover(true)}
      onTouchStart={() => onClick && setPressed(true)}
      onTouchEnd={() => setPressed(false)}
      style={{
        background: 'var(--surface)',
        backdropFilter: 'blur(24px) saturate(160%)',
        WebkitBackdropFilter: 'blur(24px) saturate(160%)',
        border: '1px solid var(--border-glass)',
        borderRadius: '24px',
        boxShadow: 'var(--shadow-card)',
        transition: 'transform 0.18s cubic-bezier(0.34,1.56,0.64,1), box-shadow 0.2s ease, background 0.2s ease',
        transform: pressed ? 'scale(0.978)' : hover && !noHover ? 'scale(1.008)' : 'scale(1)',
        cursor: onClick ? 'pointer' : 'default',
        ...style,
      }}
    >
      {children}
    </div>
  );
}

/* ── ProgressRing ────────────────────────────────────────── */
export function ProgressRing({ pct, size = 72, stroke = 6, color = 'var(--accent)', bg, label, sublabel }) {
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const dash = circ * (Math.min(pct, 100) / 100);
  const bgColor = bg || 'var(--border)';
  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={bgColor} strokeWidth={stroke} />
        <circle
          cx={size/2} cy={size/2} r={r} fill="none"
          stroke={color} strokeWidth={stroke}
          strokeDasharray={`${dash} ${circ}`}
          strokeLinecap="round"
          style={{ transition: 'stroke-dasharray 0.7s cubic-bezier(0.4,0,0.2,1)' }}
        />
      </svg>
      {label && (
        <div style={{ position:'absolute', inset:0, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center' }}>
          <span style={{ fontSize: size > 80 ? 18 : 13, fontWeight:800, color:'var(--text)', lineHeight:1 }}>{label}</span>
          {sublabel && <span style={{ fontSize:10, color:'var(--text-muted)', marginTop:2 }}>{sublabel}</span>}
        </div>
      )}
    </div>
  );
}

/* ── AnimatedNumber ──────────────────────────────────────── */
export function AnimatedNumber({ value, suffix = '', duration = 700 }) {
  const [display, setDisplay] = useState(0);
  const startRef = useRef(0);
  const startTimeRef = useRef(null);
  const rafRef = useRef(null);

  useEffect(() => {
    startRef.current = display;
    startTimeRef.current = null;
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    const step = (ts) => {
      if (!startTimeRef.current) startTimeRef.current = ts;
      const p = Math.min((ts - startTimeRef.current) / duration, 1);
      const ease = 1 - Math.pow(1 - p, 3);
      setDisplay(Math.round(startRef.current + (value - startRef.current) * ease));
      if (p < 1) rafRef.current = requestAnimationFrame(step);
    };
    rafRef.current = requestAnimationFrame(step);
    return () => rafRef.current && cancelAnimationFrame(rafRef.current);
  }, [value]);

  return <span>{display}{suffix}</span>;
}

/* ── Badge ───────────────────────────────────────────────── */
export function Badge({ label, color = 'var(--accent)' }) {
  return (
    <span style={{
      fontSize: 11, fontWeight: 600,
      padding: '3px 9px', borderRadius: 9999,
      background: color + '1A', color,
      letterSpacing: '0.02em',
    }}>
      {label}
    </span>
  );
}

/* ── PillButton ──────────────────────────────────────────── */
export function PillButton({ children, onClick, color = 'var(--accent)', outline, small, style: sx }) {
  const [pressed, setPressed] = useState(false);
  const isVar = color.startsWith('var(');
  const shadow = isVar ? `0 4px 16px rgba(0,0,0,0.08)` : `0 4px 16px ${color}30`;
  return (
    <button
      onClick={onClick}
      onMouseDown={() => setPressed(true)}
      onMouseUp={() => setPressed(false)}
      onMouseLeave={() => setPressed(false)}
      onTouchStart={() => setPressed(true)}
      onTouchEnd={() => setPressed(false)}
      style={{
        padding: small ? '7px 16px' : '11px 22px',
        borderRadius: 9999,
        fontSize: small ? 13 : 14,
        fontWeight: 700,
        border: outline ? `1.5px solid ${color}` : 'none',
        background: outline
          ? 'transparent'
          : isVar
          ? `var(--accent)`
          : color,
        color: outline ? color : 'var(--text-on-brand)',
        cursor: 'pointer',
        transform: pressed ? 'scale(0.93)' : 'scale(1)',
        boxShadow: outline ? 'none' : shadow,
        ...sx,
      }}
    >
      {children}
    </button>
  );
}

/* ── CheckBox ────────────────────────────────────────────── */
export function CheckBox({ done, onClick, color = 'var(--accent)', size = 26 }) {
  const [anim, setAnim] = useState(false);
  const handleClick = (e) => {
    e.stopPropagation();
    setAnim(true);
    setTimeout(() => setAnim(false), 350);
    onClick();
  };
  return (
    <div
      onClick={handleClick}
      style={{
        width: size, height: size, borderRadius: size * 0.35,
        border: `2px solid ${done ? color : 'var(--border)'}`,
        background: done ? color : 'transparent',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        cursor: 'pointer', flexShrink: 0,
        transform: anim ? 'scale(1.3)' : 'scale(1)',
        boxShadow: done ? `0 0 0 4px ${color}22` : 'none',
      }}
    >
      {done && (
        <svg width={size * 0.55} height={size * 0.55} viewBox="0 0 12 12" fill="none">
          <polyline points="2,6 5,9 10,3" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
    </div>
  );
}

/* ── SectionHeader ───────────────────────────────────────── */
export function SectionHeader({ title, action, actionLabel }) {
  return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom: 14 }}>
      <h2 style={{ fontSize: 18, fontWeight: 800, color:'var(--text)', margin:0, fontFamily:"'Sora', sans-serif" }}>{title}</h2>
      {action && (
        <button onClick={action} style={{
          fontSize: 13, fontWeight: 600, color: 'var(--accent)',
          background: 'none', border: 'none', cursor: 'pointer', padding: '4px 8px',
        }}>
          {actionLabel || 'See all'}
        </button>
      )}
    </div>
  );
}

/* ── MiniBar ─────────────────────────────────────────────── */
export function MiniBar({ value, max, color, height = 6 }) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  return (
    <div style={{ width: '100%', height, background: 'var(--border)', borderRadius: 99, overflow: 'hidden' }}>
      <div style={{
        height: '100%', width: `${pct}%`,
        background: color,
        borderRadius: 99,
        transition: 'width 0.7s cubic-bezier(0.4,0,0.2,1)',
      }} />
    </div>
  );
}

/* ── Portal ───────────────────────────────────────────────── */
export function Portal({ children }) {
  const el = document.getElementById('modal-portal');
  if (!el) return null;
  return createPortal(children, el);
}

/* ── Modal ───────────────────────────────────────────────── */
export function Modal({ open, onClose, title, children }) {
  useEffect(() => {
    const fn = (e) => { if (e.key === 'Escape') onClose(); };
    if (open) document.addEventListener('keydown', fn);
    return () => document.removeEventListener('keydown', fn);
  }, [open, onClose]);

  if (!open) return null;
  return createPortal(
    <div
      onClick={onClose}
      style={{
        position: 'absolute', inset: 0, zIndex: 1000,
        background: 'var(--overlay)',
        backdropFilter: 'var(--overlay-blur)',
        WebkitBackdropFilter: 'var(--overlay-blur)',
        display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
        animation: 'fadeIn 0.2s ease',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: 430,
          background: 'var(--nav-bg)',
          backdropFilter: 'blur(32px) saturate(200%)',
          WebkitBackdropFilter: 'blur(32px) saturate(200%)',
          borderRadius: '30px 30px 0 0',
          border: '1px solid var(--border-glass)',
          borderBottom: 'none',
          padding: '24px 24px 48px',
          animation: 'slideUp 0.32s cubic-bezier(0.34,1.56,0.64,1)',
          boxShadow: '0 -12px 64px var(--shadow-color, rgba(0,0,0,0.15))',
        }}
      >
        <div style={{ width: 44, height: 5, background: 'var(--border)', borderRadius: 99, margin: '0 auto 22px' }} />
        <h3 style={{ fontSize: 19, fontWeight: 800, color: 'var(--text)', margin: '0 0 22px', fontFamily:"'Sora',sans-serif" }}>{title}</h3>
        {children}
      </div>
    </div>,
    document.getElementById('modal-portal')
  );
}

/* ── Input styles helper ─────────────────────────────────── */
export const inputStyle = {
  width: '100%',
  padding: '12px 14px',
  borderRadius: 16,
  border: '1.5px solid var(--border)',
  background: 'var(--input-bg)',
  backdropFilter: 'blur(12px)',
  color: 'var(--text)',
  fontSize: 14,
  fontWeight: 500,
  outline: 'none',
  boxSizing: 'border-box',
  fontFamily: 'inherit',
};

/* ── Real SVG Line Chart ─────────────────────────────────── */
export function LineChart({ data, color, height = 120, label, showArea = true }) {
  const w = 320, h = height;
  const vals = data.map(d => d.value);
  const max = Math.max(...vals, 1);
  const min = 0;
  const range = max - min || 1;
  const id = `lg_${color.replace(/[^a-z0-9]/gi, '')}`;

  const pts = data.map((d, i) => [
    (i / (data.length - 1)) * w,
    h - ((d.value - min) / range) * (h * 0.85) - 10,
  ]);

  const pathStr = pts.map((p, i) => {
    if (i === 0) return `M${p[0].toFixed(1)},${p[1].toFixed(1)}`;
    const prev = pts[i - 1];
    const cpx = ((prev[0] + p[0]) / 2).toFixed(1);
    return `C${cpx},${prev[1].toFixed(1)} ${cpx},${p[1].toFixed(1)} ${p[0].toFixed(1)},${p[1].toFixed(1)}`;
  }).join(' ');

  const areaStr = `${pathStr} L${w},${h} L0,${h} Z`;

  const today = data.findIndex(d => d.isToday);
  const todayPt = today >= 0 ? pts[today] : null;

  return (
    <div style={{ position: 'relative' }}>
      <svg width="100%" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" style={{ overflow: 'visible', display: 'block' }}>
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.30" />
            <stop offset="100%" stopColor={color} stopOpacity="0.02" />
          </linearGradient>
        </defs>
        {/* Grid lines */}
        {[25, 50, 75, 100].map(v => {
          const y = h - ((v / range) * (h * 0.85)) - 10;
          return <line key={v} x1="0" y1={y} x2={w} y2={y} stroke="var(--chart-grid)" strokeWidth="1" strokeDasharray="4 4" />;
        })}
        {/* Area */}
        {showArea && <path d={areaStr} fill={`url(#${id})`} />}
        {/* Line */}
        <path d={pathStr} fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        {/* Dots */}
        {pts.map((p, i) => (
          <circle key={i} cx={p[0]} cy={p[1]} r={data[i].isToday ? 5 : 3}
            fill={data[i].isToday ? color : 'var(--surface)'}
            stroke={color} strokeWidth="2"
          />
        ))}
        {/* Today highlight */}
        {todayPt && (
          <line x1={todayPt[0]} y1="0" x2={todayPt[0]} y2={h}
            stroke={color} strokeWidth="1" strokeDasharray="3 3" strokeOpacity="0.5" />
        )}
      </svg>
      {/* X axis labels */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
        {data.filter((_, i) => i % Math.ceil(data.length / 7) === 0 || i === data.length - 1).map((d, i) => (
          <span key={i} style={{ fontSize: 10, color: d.isToday ? color : 'var(--text-muted)', fontWeight: d.isToday ? 700 : 400 }}>
            {d.label}
          </span>
        ))}
      </div>
    </div>
  );
}

/* ── Real Bar Chart ──────────────────────────────────────── */
export function BarChart({ data, color, height = 100 }) {
  const max = Math.max(...data.map(d => d.value), 1);
  return (
    <div>
      <div style={{ display: 'flex', gap: 5, alignItems: 'flex-end', height }}>
        {data.map((d, i) => (
          <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0 }}>
            <div style={{
              width: '100%',
              height: `${Math.max((d.value / max) * height, 4)}px`,
              background: d.isToday
                ? color
                : d.value >= 80
                ? color + 'CC'
                : d.value >= 50
                ? color + '88'
                : color + '44',
              borderRadius: '5px 5px 3px 3px',
              transition: 'height 0.6s cubic-bezier(0.4,0,0.2,1)',
              border: d.isToday ? `2px solid ${color}` : 'none',
              boxShadow: d.isToday ? `0 0 12px ${color}60` : 'none',
            }} />
          </div>
        ))}
      </div>
      {/* X axis */}
      <div style={{ display: 'flex', gap: 5, marginTop: 6 }}>
        {data.map((d, i) => (
          <div key={i} style={{ flex: 1, textAlign: 'center' }}>
            <span style={{ fontSize: 9, color: d.isToday ? color : 'var(--text-muted)', fontWeight: d.isToday ? 800 : 400 }}>
              {d.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Swipeable Chart Tabs ────────────────────────────────── */
export function SwipeableCharts({ charts }) {
  const [activeIdx, setActiveIdx] = useState(0);
  const scrollRef = useRef(null);

  const goTo = (idx) => {
    setActiveIdx(idx);
    scrollRef.current?.children[idx]?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'start' });
  };

  const handleScroll = () => {
    if (!scrollRef.current) return;
    const width = scrollRef.current.offsetWidth;
    const idx = Math.round(scrollRef.current.scrollLeft / width);
    setActiveIdx(idx);
  };

  return (
    <div>
      {/* Tab buttons */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 14, overflowX: 'auto', paddingBottom: 2 }}>
        {charts.map((chart, i) => (
          <button key={i} onClick={() => goTo(i)} style={{
            padding: '7px 16px',
            borderRadius: 9999,
            fontSize: 12,
            fontWeight: 700,
            border: `1.5px solid ${activeIdx === i ? chart.color : 'var(--border)'}`,
            background: activeIdx === i ? chart.color + '18' : 'transparent',
            color: activeIdx === i ? chart.color : 'var(--text-muted)',
            cursor: 'pointer',
            whiteSpace: 'nowrap',
            flexShrink: 0,
            backdropFilter: 'blur(8px)',
          }}>
            {chart.icon} {chart.label}
          </button>
        ))}
      </div>
      {/* Swipeable slides */}
      <div
        ref={scrollRef}
        className="chart-scroll"
        onScroll={handleScroll}
        style={{ gap: 0 }}
      >
        {charts.map((chart, i) => (
          <div key={i} className="chart-slide" style={{ width: '100%' }}>
            {chart.content}
          </div>
        ))}
      </div>
      {/* Dots indicator */}
      <div style={{ display: 'flex', justifyContent: 'center', gap: 6, marginTop: 14 }}>
        {charts.map((chart, i) => (
          <div key={i} onClick={() => goTo(i)} style={{
            width: activeIdx === i ? 20 : 6,
            height: 6,
            borderRadius: 99,
            background: activeIdx === i ? chart.color : 'var(--border)',
            cursor: 'pointer',
            transition: 'all 0.3s cubic-bezier(0.4,0,0.2,1)',
          }} />
        ))}
      </div>
    </div>
  );
}