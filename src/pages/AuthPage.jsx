import React, { useState } from 'react';
import { signInWithGoogle, signInWithEmail, signUpWithEmail } from '../firebase/auth';
import { createUserProfile } from '../firebase/friends';
import matchaHero from '../assets/hero-matcha.jpg';

// ── Design tokens ──────────────────────────────────────────────────────────────
const c = {
  green:        'var(--brand-primary)',
  greenDark:    'var(--brand-primary-dark)',
  greenShadow:  'var(--accent-soft)',
  white:        'var(--bg)',
  black:        'var(--text-primary)',
  text:         'var(--text-primary)',
  textSub:      'var(--text-secondary)',
  textMuted:    'var(--text-muted)',
  inputBg:      'var(--input-bg)',
  inputBorder:  'var(--input-border)',
  inputFocus:   'var(--brand-primary)',
  divider:      'var(--border-subtle)',
  errorRed:     '#EF4444',
  surface:      'var(--surface-primary)',
  textOnBrand:  'var(--text-on-brand)',
};

// ── Shared styles ──────────────────────────────────────────────────────────────
const s = {
  screen: {
    minHeight: '100dvh',
    background: c.white,
    display: 'flex',
    flexDirection: 'column',
    overflowX: 'hidden',
  },

  // Hero image block
  hero: {
    width: '100%',
    height: '55dvh',
    minHeight: 300,
    position: 'relative',
    flexShrink: 0,
    overflow: 'hidden',
  },
  heroImg: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    objectPosition: 'center 30%',
    display: 'block',
  },
  heroOverlay: {
    position: 'absolute',
    inset: 0,
    background: `linear-gradient(to bottom, rgba(0,0,0,0.02) 60%, ${c.white} 100%)`,
  },

  // Body below hero
  body: {
    flex: 1,
    padding: '28px 24px 40px',
    display: 'flex',
    flexDirection: 'column',
    position: 'relative',
  },

  // Back button
  backRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    marginBottom: 24,
    cursor: 'pointer',
    width: 'fit-content',
  },
  backArrow: {
    fontSize: 18,
    color: c.textSub,
    lineHeight: 1,
  },
  backText: {
    fontSize: 14,
    color: c.textSub,
    fontWeight: 500,
  },

  // Titles
  eyebrow: {
    fontSize: 12,
    fontWeight: 600,
    color: c.green,
    letterSpacing: '0.1em',
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  title: {
    fontSize: 30,
    fontWeight: 700,
    color: c.text,
    letterSpacing: '-0.03em',
    lineHeight: 1.1,
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 14,
    color: c.textSub,
    lineHeight: 1.5,
    marginBottom: 28,
  },

  // Input field
  fieldWrap: {
    marginBottom: 14,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: 600,
    color: c.textSub,
    marginBottom: 6,
    display: 'block',
    letterSpacing: '0.04em',
  },
  inputRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    background: c.inputBg,
    border: `1.5px solid ${c.inputBorder}`,
    borderRadius: 14,
    padding: '0 14px',
    height: 50,
    transition: 'border-color 0.2s, box-shadow 0.2s',
  },
  inputRowFocus: {
    borderColor: c.inputFocus,
    boxShadow: `0 0 0 3px var(--accent-soft)`,
    background: c.surface,
  },
  inputIcon: {
    fontSize: 17,
    color: c.textMuted,
    flexShrink: 0,
    lineHeight: 1,
  },
  input: {
    flex: 1,
    border: 'none',
    background: 'transparent',
    fontSize: 15,
    color: c.text,
    fontFamily: 'inherit',
    outline: 'none',
    minWidth: 0,
  },
  eyeBtn: {
    background: 'none',
    border: 'none',
    padding: 0,
    cursor: 'pointer',
    fontSize: 17,
    color: c.textMuted,
    display: 'flex',
    alignItems: 'center',
    flexShrink: 0,
  },

  // Name row (two side-by-side)
  nameRow: {
    display: 'flex',
    gap: 10,
    marginBottom: 14,
  },
  nameField: {
    flex: 1,
    minWidth: 0,
  },

  // Forgot / remember row
  metaRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 22,
  },
  rememberLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: 7,
    cursor: 'pointer',
    userSelect: 'none',
  },
  checkbox: {
    width: 17,
    height: 17,
    borderRadius: 5,
    background: c.green,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  checkmark: {
    width: 10,
    height: 10,
    stroke: c.textOnBrand,
    strokeWidth: 2.5,
    fill: 'none',
  },
  rememberText: {
    fontSize: 13,
    color: c.textSub,
  },
  forgotLink: {
    fontSize: 13,
    color: c.textSub,
    cursor: 'pointer',
    fontWeight: 500,
    background: 'none',
    border: 'none',
    padding: 0,
    fontFamily: 'inherit',
  },

  // Buttons
  primaryBtn: {
    width: '100%',
    height: 52,
    borderRadius: 999,
    border: 'none',
    background: c.green,
    color: c.textOnBrand,
    fontSize: 16,
    fontWeight: 700,
    cursor: 'pointer',
    fontFamily: 'inherit',
    letterSpacing: '0.02em',
    boxShadow: `0 4px 16px ${c.greenShadow}`,
    transition: 'opacity 0.15s, transform 0.1s',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 14,
  },
  outlineBtn: {
    width: '100%',
    height: 52,
    borderRadius: 999,
    border: `1.5px solid ${c.inputBorder}`,
    background: c.surface,
    color: c.text,
    fontSize: 15,
    fontWeight: 600,
    cursor: 'pointer',
    fontFamily: 'inherit',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 14,
    transition: 'background 0.15s',
  },

  // Divider
  dividerRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    marginBottom: 14,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    background: c.divider,
  },
  dividerText: {
    fontSize: 12,
    color: c.textMuted,
    whiteSpace: 'nowrap',
    fontWeight: 500,
  },

  // Google button
  googleBtn: {
    width: '100%',
    height: 52,
    borderRadius: 999,
    border: `1.5px solid ${c.inputBorder}`,
    background: c.surface,
    color: c.text,
    fontSize: 15,
    fontWeight: 600,
    cursor: 'pointer',
    fontFamily: 'inherit',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    transition: 'background 0.15s',
  },

  // Terms row
  termsRow: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 9,
    marginBottom: 18,
  },
  termsText: {
    fontSize: 12,
    color: c.textSub,
    lineHeight: 1.5,
  },
  termsLink: {
    color: c.green,
    fontWeight: 600,
    cursor: 'pointer',
    textDecoration: 'none',
  },

  // Bottom note
  bottomNote: {
    textAlign: 'center',
    fontSize: 14,
    color: c.textSub,
    marginTop: 20,
  },
  bottomLink: {
    color: c.green,
    fontWeight: 600,
    cursor: 'pointer',
    background: 'none',
    border: 'none',
    padding: 0,
    fontFamily: 'inherit',
    fontSize: 14,
  },

  // Error
  errorText: {
    fontSize: 13,
    color: c.errorRed,
    textAlign: 'center',
    marginBottom: 10,
    fontWeight: 500,
  },

  // Guest link
  guestLink: {
    textAlign: 'center',
    fontSize: 13,
    color: c.textMuted,
    marginTop: 8,
    cursor: 'pointer',
  },
  guestSpan: {
    color: c.green,
    fontWeight: 600,
  },
};

// ── Icons ──────────────────────────────────────────────────────────────────────
const GoogleIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/>
    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
  </svg>
);

const EyeIcon = ({ off }) => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {off ? (
      <>
        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
        <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
        <line x1="1" y1="1" x2="23" y2="23"/>
      </>
    ) : (
      <>
        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
        <circle cx="12" cy="12" r="3"/>
      </>
    )}
  </svg>
);

const CheckIcon = () => (
  <svg width="10" height="10" viewBox="0 0 12 12" fill="none" aria-hidden="true">
    <polyline points="2,6 5,9 10,3" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

// ── Error map ──────────────────────────────────────────────────────────────────
const friendlyError = (code) => {
  const map = {
    'auth/invalid-email':        'Please enter a valid email address.',
    'auth/user-not-found':       'No account found. Did you sign in with Google?',
    'auth/wrong-password':       'Incorrect password. Try Google sign-in instead.',
    'auth/invalid-credential':   'Invalid email or password.',
    'auth/email-already-in-use': 'An account with this email already exists.',
    'auth/weak-password':        'Password must be at least 6 characters.',
    'auth/too-many-requests':    'Too many attempts. Please wait and try again.',
    'auth/popup-closed-by-user': 'Google sign-in was cancelled.',
    'auth/handle-taken':         'This @handle is already taken.',
    'auth/missing-handle':       'Please enter a @handle.',
    'auth/unauthorized-domain':  'Domain not authorized. Add it in Firebase Console.',
  };
  return map[code] || 'Something went wrong. Please try again.';
};

// ── Reusable Field ─────────────────────────────────────────────────────────────
function Field({ label, type = 'text', placeholder, value, onChange, focusKey, focusState, onFocus, onBlur, icon, showToggle, showPw, onTogglePw, style }) {
  const isFocused = focusState === focusKey;
  return (
    <div style={{ ...s.fieldWrap, ...style }}>
      {label && <label style={s.fieldLabel}>{label}</label>}
      <div style={{ ...s.inputRow, ...(isFocused ? s.inputRowFocus : {}) }}>
        {icon && <span style={s.inputIcon}>{icon}</span>}
        <input
          style={s.input}
          type={showToggle ? (showPw ? 'text' : 'password') : type}
          placeholder={placeholder}
          value={value}
          onChange={e => onChange(e.target.value)}
          onFocus={() => onFocus(focusKey)}
          onBlur={() => onBlur(null)}
          autoComplete={type === 'password' ? 'current-password' : undefined}
        />
        {showToggle && (
          <button style={s.eyeBtn} onClick={() => onTogglePw(p => !p)} type="button" aria-label={showPw ? 'Hide password' : 'Show password'}>
            <EyeIcon off={!showPw} />
          </button>
        )}
      </div>
    </div>
  );
}

// ── Hero Image ─────────────────────────────────────────────────────────────────
function Hero() {
  return (
    <div style={s.hero}>
      <img src={matchaHero} alt="" style={s.heroImg} aria-hidden="true" />
      <div style={s.heroOverlay} />
    </div>
  );
}

// ── Welcome Screen ─────────────────────────────────────────────────────────────
function WelcomeScreen({ onSignIn, onCreateAccount }) {
  return (
    <div style={s.screen}>
      <Hero />
      <div style={{ ...s.body, justifyContent: 'flex-end', paddingBottom: 24, gap: 8 }}>
        <div>
          <div style={s.eyebrow}>Wellness</div>
          <h1 style={s.title}>Welcome to{'\n'}LifeFlow</h1>
          <p style={s.subtitle}>Track habits, goals, and your wellbeing — all in one place.</p>
        </div>

        <button style={s.primaryBtn} onClick={onCreateAccount}>
          Create account
        </button>
        <button style={s.outlineBtn} onClick={onSignIn}>
          Already have an account
        </button>
      </div>
    </div>
  );
}

// ── Sign In Screen ─────────────────────────────────────────────────────────────
function SignInScreen({ onBack, onSwitch }) {
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw]     = useState(false);
  const [focus, setFocus]       = useState(null);
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState('');

  const handleGoogle = async () => {
    setError(''); setLoading('google');
    try { await signInWithGoogle(); }
    catch (e) { setError(friendlyError(e.code)); setLoading(''); }
  };

  const handleLogin = async () => {
    setError(''); setLoading('login');
    try { await signInWithEmail(email, password); }
    catch (e) { setError(friendlyError(e.code)); setLoading(''); }
  };

  const disabled = !!loading;

  return (
    <div style={s.screen}>
      <div style={{ ...s.body, justifyContent: 'center' }}>
        <button style={{ ...s.backRow, background: 'none', border: 'none', padding: 0, fontFamily: 'inherit', position: 'absolute', top: 20, left: 24 }} onClick={onBack} aria-label="Go back">
          <span style={s.backArrow}>‹</span>
          <span style={s.backText}>Back</span>
        </button>

        <h1 style={s.title}>Login account</h1>
        <p style={s.subtitle}>Welcome back! Sign in to continue.</p>

        <Field
          label="Email"
          type="email"
          placeholder="example@gmail.com"
          value={email}
          onChange={setEmail}
          focusKey="email"
          focusState={focus}
          onFocus={setFocus}
          onBlur={setFocus}
          icon="✉"
        />
        <Field
          label="Password"
          placeholder="Enter password"
          value={password}
          onChange={setPassword}
          focusKey="password"
          focusState={focus}
          onFocus={setFocus}
          onBlur={setFocus}
          icon="🔒"
          showToggle
          showPw={showPw}
          onTogglePw={setShowPw}
        />

        <div style={s.metaRow}>
          <label style={s.rememberLabel}>
            <div style={s.checkbox}><CheckIcon /></div>
            <span style={s.rememberText}>Keep me logged in</span>
          </label>
          <button style={s.forgotLink} onClick={() => {}} disabled={disabled}>Forgot password?</button>
        </div>

        {error && <p style={s.errorText}>{error}</p>}

        <button style={{ ...s.primaryBtn, opacity: disabled ? 0.7 : 1 }} onClick={handleLogin} disabled={disabled}>
          {loading === 'login' ? 'Signing in…' : 'Login'}
        </button>

        <div style={s.dividerRow}>
          <div style={s.dividerLine} />
          <span style={s.dividerText}>Or sign in with</span>
          <div style={s.dividerLine} />
        </div>

        <button style={{ ...s.googleBtn, opacity: disabled ? 0.7 : 1 }} onClick={handleGoogle} disabled={disabled}>
          <GoogleIcon />
          {loading === 'google' ? 'Signing in…' : 'Continue with Google'}
        </button>

        <p style={s.bottomNote}>
          Don't have an account?{' '}
          <button style={s.bottomLink} onClick={onSwitch}>Sign up</button>
        </p>
      </div>
    </div>
  );
}

// ── Already Have Account Screen ────────────────────────────────────────────────
function AlreadyHaveAccountScreen({ email, onSignIn }) {
  return (
    <div style={{ ...s.screen, alignItems: 'center', justifyContent: 'center', padding: 32, textAlign: 'center' }}>
      <div style={{
        width: 80, height: 80, borderRadius: 24,
        background: 'var(--accent-soft)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 36, marginBottom: 20,
      }}>👤</div>
      <h1 style={{ ...s.title, marginBottom: 8 }}>Already have<br/>an account?</h1>
      <p style={{ ...s.subtitle, marginBottom: 32 }}>
        <strong>{email}</strong> is already registered.<br/>Sign in instead to continue.
      </p>
      <button style={s.primaryBtn} onClick={onSignIn}>
        Sign In
      </button>
      <p style={s.guestLink} onClick={() => window.location.reload()}>
        Try a different email
      </p>
    </div>
  );
}

// ── Create Account Screen ──────────────────────────────────────────────────────
function CreateAccountScreen({ onBack, onSwitchToSignIn }) {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName]   = useState('');
  const [handle, setHandle]       = useState('');
  const [email, setEmail]         = useState('');
  const [password, setPassword]   = useState('');
  const [confirm, setConfirm]     = useState('');
  const [showPw, setShowPw]       = useState(false);
  const [showCf, setShowCf]       = useState(false);
  const [agreed, setAgreed]       = useState(false);
  const [focus, setFocus]         = useState(null);
  const [error, setError]         = useState('');
  const [loading, setLoading]     = useState('');
  const [existingEmail, setExistingEmail] = useState('');

  const handleGoogle = async () => {
    setError(''); setLoading('google');
    try { await signInWithGoogle(); }
    catch (e) { setError(friendlyError(e.code)); setLoading(''); }
  };

  const handleCreate = async () => {
    if (password !== confirm) { setError('Passwords do not match.'); return; }
    if (!agreed) { setError('Please agree to the Terms and Conditions.'); return; }
    setError(''); setLoading('create');
    try {
      const cleanHandle  = handle.toLowerCase().replace(/^@/, '').trim();
      if (!cleanHandle) throw { code: 'auth/missing-handle' };
      const displayName  = [firstName, lastName].filter(Boolean).join(' ').trim();
      const cred         = await signUpWithEmail(email, password, displayName);
      await createUserProfile(cred.user.uid, cleanHandle, displayName, '');
    } catch (e) {
      if (e.code === 'auth/email-already-in-use') {
        setExistingEmail(email);
      } else {
        setError(friendlyError(e.code));
      }
      setLoading('');
    }
  };

  if (existingEmail) {
    return <AlreadyHaveAccountScreen email={existingEmail} onSignIn={onSwitchToSignIn} />;
  }

  const disabled = !!loading;

  return (
    <div style={s.screen}>
      <div style={s.body}>
        <button style={{ ...s.backRow, background: 'none', border: 'none', padding: 0, fontFamily: 'inherit' }} onClick={onBack} aria-label="Go back">
          <span style={s.backArrow}>‹</span>
          <span style={s.backText}>Back</span>
        </button>

        <h1 style={s.title}>Create account</h1>
        <p style={s.subtitle}>Sign up to get started.</p>

        {/* Name row */}
        <div style={s.nameRow}>
          <div style={s.nameField}>
            <label style={s.fieldLabel}>First name</label>
            <div style={{ ...s.inputRow, ...(focus === 'first' ? s.inputRowFocus : {}) }}>
              <input
                style={s.input}
                placeholder="First"
                value={firstName}
                onChange={e => setFirstName(e.target.value)}
                onFocus={() => setFocus('first')}
                onBlur={() => setFocus(null)}
              />
            </div>
          </div>
          <div style={s.nameField}>
            <label style={s.fieldLabel}>Last name</label>
            <div style={{ ...s.inputRow, ...(focus === 'last' ? s.inputRowFocus : {}) }}>
              <input
                style={s.input}
                placeholder="Last"
                value={lastName}
                onChange={e => setLastName(e.target.value)}
                onFocus={() => setFocus('last')}
                onBlur={() => setFocus(null)}
              />
            </div>
          </div>
        </div>

        <Field
          label="@ Handle"
          placeholder="@yourhandle"
          value={handle}
          onChange={v => setHandle(v.replace(/\s/g, ''))}
          focusKey="handle"
          focusState={focus}
          onFocus={setFocus}
          onBlur={setFocus}
          icon="@"
        />
        <Field
          label="Email"
          type="email"
          placeholder="example@gmail.com"
          value={email}
          onChange={setEmail}
          focusKey="email"
          focusState={focus}
          onFocus={setFocus}
          onBlur={setFocus}
          icon="✉"
        />
        <Field
          label="Password"
          placeholder="Create password"
          value={password}
          onChange={setPassword}
          focusKey="password"
          focusState={focus}
          onFocus={setFocus}
          onBlur={setFocus}
          icon="🔒"
          showToggle
          showPw={showPw}
          onTogglePw={setShowPw}
        />
        <Field
          label="Confirm password"
          placeholder="Re-enter password"
          value={confirm}
          onChange={setConfirm}
          focusKey="confirm"
          focusState={focus}
          onFocus={setFocus}
          onBlur={setFocus}
          icon="🔒"
          showToggle
          showPw={showCf}
          onTogglePw={setShowCf}
        />

        {/* Terms */}
        <div style={s.termsRow}>
          <div
            style={{
              ...s.checkbox,
              background: agreed ? c.green : 'transparent',
              border: agreed ? 'none' : `1.5px solid ${c.inputBorder}`,
              cursor: 'pointer',
              flexShrink: 0,
              marginTop: 1,
            }}
            onClick={() => setAgreed(a => !a)}
            role="checkbox"
            aria-checked={agreed}
            tabIndex={0}
            onKeyDown={e => e.key === ' ' && setAgreed(a => !a)}
          >
            {agreed && <CheckIcon />}
          </div>
          <span style={s.termsText}>
            I agree to the{' '}
            <span style={s.termsLink}>Terms</span>
            {' '}and{' '}
            <span style={s.termsLink}>Conditions</span>
          </span>
        </div>

        {error && <p style={s.errorText}>{error}</p>}

        <button style={{ ...s.primaryBtn, opacity: disabled ? 0.7 : 1 }} onClick={handleCreate} disabled={disabled}>
          {loading === 'create' ? 'Creating account…' : 'Create account'}
        </button>

        <div style={s.dividerRow}>
          <div style={s.dividerLine} />
          <span style={s.dividerText}>Or sign up with</span>
          <div style={s.dividerLine} />
        </div>

        <button style={{ ...s.googleBtn, opacity: disabled ? 0.7 : 1 }} onClick={handleGoogle} disabled={disabled}>
          <GoogleIcon />
          {loading === 'google' ? 'Signing up…' : 'Continue with Google'}
        </button>

        <p style={s.bottomNote}>
          Already have an account?{' '}
          <button style={s.bottomLink} onClick={onBack}>Login</button>
        </p>
      </div>
    </div>
  );
}

// ── Root ───────────────────────────────────────────────────────────────────────
export default function AuthPage() {
  const [screen, setScreen] = useState('welcome');

  if (screen === 'welcome') {
    return (
      <WelcomeScreen
        onSignIn={() => setScreen('signin')}
        onCreateAccount={() => setScreen('create')}
      />
    );
  }
  if (screen === 'signin') {
    return (
      <SignInScreen
        onBack={() => setScreen('welcome')}
        onSwitch={() => setScreen('create')}
      />
    );
  }
  return (
    <CreateAccountScreen
      onBack={() => setScreen('welcome')}
      onSwitchToSignIn={() => setScreen('signin')}
    />
  );
}