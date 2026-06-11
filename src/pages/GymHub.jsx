import React from 'react';

const CARDS = [
  { tab: 'gymroutines', label: 'Gym Routines', gradient: 'linear-gradient(135deg, #6366F1 0%, #818CF8 100%)', shadow: 'rgba(99,102,241,0.4)', icon: '🏋️' },
  { tab: 'routines', label: 'Routine Planner', gradient: 'linear-gradient(135deg, #8B5CF6 0%, #A78BFA 100%)', shadow: 'rgba(139,92,246,0.4)', icon: '🔁' },
  { tab: 'meals', label: 'Meal Planner', gradient: 'linear-gradient(135deg, #F43F5E 0%, #FB7185 100%)', shadow: 'rgba(244,63,94,0.4)', icon: '🍽' },
  { tab: 'water', label: 'Water Tracker', gradient: 'linear-gradient(135deg, #06B6D4 0%, #22D3EE 100%)', shadow: 'rgba(6,182,212,0.4)', icon: '💧' },
];

export default function GymHub({ store, setActiveTab, user }) {
  return (
    <div style={{
      padding: '48px 24px 24px',
      minHeight: '100%',
      background: 'var(--bg-gradient)',
      display: 'flex',
      flexDirection: 'column',
    }}>
      <div style={{ textAlign: 'center', marginBottom: 32 }}>
        <div style={{
          width: 56, height: 56, borderRadius: 18,
          background: 'linear-gradient(135deg, var(--accent) 0%, #818CF8 100%)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 26, margin: '0 auto 14px',
          boxShadow: '0 6px 24px rgba(99,102,241,0.35)',
        }}>
          <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3"/>
            <circle cx="12" cy="12" r="9" opacity="0.4"/>
            <path d="M12 2v4" opacity="0.6"/><path d="M12 18v4" opacity="0.6"/>
            <path d="M2 12h4" opacity="0.6"/><path d="M18 12h4" opacity="0.6"/>
          </svg>
        </div>
        <h1 style={{
          fontSize: 24, fontWeight: 900, color: 'var(--text)', margin: 0,
          fontFamily: "'Outfit', sans-serif",
        }}>
          Activity Hub
        </h1>
        <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>
          Manage your fitness, meals & hydration
        </p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {CARDS.map((card) => (
          <button
            key={card.tab}
            onClick={() => setActiveTab(card.tab)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 16,
              padding: '18px 20px',
              borderRadius: 20,
              background: card.gradient,
              border: 'none',
              cursor: 'pointer',
              fontFamily: 'inherit',
              boxShadow: `0 8px 28px ${card.shadow}, 0 2px 8px rgba(0,0,0,0.10)`,
              transition: 'all 0.2s cubic-bezier(0.22,1,0.36,1)',
              textAlign: 'left',
              width: '100%',
            }}
          >
            <div style={{
              width: 52, height: 52, borderRadius: 16,
              background: 'rgba(255,255,255,0.2)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 26,
              boxShadow: '0 4px 12px rgba(0,0,0,0.10), inset 0 1.5px 0 rgba(255,255,255,0.35)',
              border: '1.5px solid rgba(255,255,255,0.2)',
              flexShrink: 0,
            }}>
              {card.icon}
            </div>
            <div>
              <div style={{ fontSize: 16, fontWeight: 800, color: '#fff', letterSpacing: '-0.2px' }}>
                {card.label}
              </div>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)', marginTop: 2 }}>
                Tap to open
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
