import React, { useState, useEffect } from 'react';

function SignalBars() {
  const [bars, setBars] = useState(3);
  useEffect(() => {
    const tick = () => setBars(Math.random() < 0.3 ? Math.floor(Math.random() * 2) + 2 : Math.floor(Math.random() * 2) + 3);
    tick();
    const id = setInterval(tick, 8000);
    return () => clearInterval(id);
  }, []);
  return (
    <svg viewBox="0 0 16 10" width="14" height="10" fill="currentColor" style={{ opacity: 0.7 }}>
      {[0,1,2,3].map(i => (
        <rect key={i} x={i * 3.8} y={10 - (i + 1) * 2.2} width="2.6" height={(i + 1) * 2.2} rx="0.7"
          opacity={i < bars ? 1 : 0.25}
        />
      ))}
    </svg>
  );
}

function BatteryIcon() {
  const [level, setLevel] = useState(78);
  const [charging, setCharging] = useState(false);
  useEffect(() => {
    let mounted = true;
    if (navigator.getBattery) {
      navigator.getBattery().then(battery => {
        if (!mounted) return;
        const update = () => {
          if (!mounted) return;
          setLevel(Math.round(battery.level * 100));
          setCharging(battery.charging);
        };
        update();
        battery.addEventListener('levelchange', update);
        battery.addEventListener('chargingchange', update);
      });
    } else {
      const tick = () => { if (mounted) setLevel(Math.floor(Math.random() * 31) + 55); };
      tick();
      const id = setInterval(tick, 15000);
      return () => { mounted = false; clearInterval(id); };
    }
    return () => { mounted = false; };
  }, []);
  const w = 21, h = 11, inset = 1.5, fillW = Math.max(2, (level / 100) * (w - inset * 2 - 1));
  const tipX = w - 1, tipW = 1.8, tipH = 4;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 2.5, position: 'relative' }}>
      {charging && (
        <svg viewBox="0 0 8 12" width="7" height="10" fill="currentColor" style={{ opacity: 0.6 }}>
          <path d="M4 0L0 7h3v5l4-7H4V0z" />
        </svg>
      )}
      <svg viewBox={`0 0 ${w} ${h}`} width={w} height={h} fill="none" stroke="currentColor" strokeWidth="0.8" style={{ opacity: 0.7 }}>
        <rect x={inset} y={1} width={w - inset - tipW} height={h - 2} rx="1.8" fill="none" />
        <rect x={inset + 1} y={2} width={fillW} height={h - 4} rx="0.8" fill="currentColor" opacity={level < 20 ? 0.7 : 0.5} />
        <rect x={w - tipW} y={(h - tipH) / 2} width={tipW} height={tipH} rx="0.5" fill="currentColor" />
      </svg>
      <span style={{ fontSize: 9, fontWeight: 600, opacity: 0.65, minWidth: 20, textAlign: 'right' }}>
        {level}%
      </span>
    </div>
  );
}

export default function PhoneStatusBar() {
  const [time, setTime] = useState(() => {
    const d = new Date();
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  });

  useEffect(() => {
    const tick = () => {
      const d = new Date();
      setTime(`${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`);
    };
    const id = setInterval(tick, 30000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="phone-status-bar" style={{
      height: 28, padding: '0 22px 0 20px',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      fontSize: 10, fontWeight: 700,
      color: 'var(--text-muted)',
      flexShrink: 0,
      background: 'var(--bg)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ fontWeight: 500, opacity: 0.5, fontSize: 9 }}>
          {new Date().toLocaleDateString('en', { weekday: 'short', month: 'numeric', day: 'numeric' }).replace(/,/g, '')}
        </span>
      </div>
      <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 12, fontWeight: 600, letterSpacing: '0.02em' }}>
        {time}
      </span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
        <SignalBars />
        <BatteryIcon />
      </div>
    </div>
  );
}
