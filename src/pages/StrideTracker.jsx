/**
 * StrideTracker.jsx — Visual redesign (bold/energetic, premium fitness aesthetic)
 *
 * All functional logic, GPS handling, iOS fixes, and data flow are UNCHANGED
 * from the original. Only presentation (styles/markup) has been redesigned.
 *
 * DESIGN SYSTEM
 * ──────────────────────────────────────────────────────────────────────────
 * Palette:
 *   --ink        #0A0E0D   near-black base — full-bleed dark canvas
 *   --surface    #141816   raised cards
 *   --surface-2  #1D2220   inputs, secondary surfaces
 *   --volt       #CFFF5C   signature accent — active states, walking, CTA
 *   --ember      #FF5C3D   secondary accent — jogging, calories, stop/danger
 *   --line       #2A302D   hairline borders
 *   --text       #F4F6F2   primary text (off-white, not pure white)
 *   --text-dim   #8B958F   secondary/muted text
 *
 * Type:
 *   Display (big stats): 'Archivo Black', system fallback — heavy, condensed,
 *     tabular-nums, tight tracking — reads like a sports-watch readout.
 *   UI (labels/buttons): system sans (-apple-system stack) — clean, never
 *     competes with the display face.
 *
 * Signature element: the "effort ring" — a radial progress ring around the
 * mode toggle / record button that fills with --volt or --ember depending on
 * mode and intensity, replacing the old emoji icons + plain pill buttons.
 * ──────────────────────────────────────────────────────────────────────────
 *
 * iPhone-compatible fixes (unchanged from original, kept verbatim):
 * 1. GPS accuracy filter: ignores points with accuracy > 100m
 * 2. watchPosition timeout raised to 30 000ms — iOS cold GPS needs time
 * 3. maximumAge raised to 15 000ms — reduces battery hammering
 * 4. enableHighAccuracy gracefully falls back if it fails (Low Power Mode)
 * 5. Elapsed timer uses a stable `startRef` so iOS backgrounding doesn't corrupt time
 * 6. pausedElapsedRef double-count bug fixed in stopTracking
 * 7. Pace calculation uses total (elapsed) correctly
 * 8. iOS PWA meta tags exported as a <IOSHead /> helper component
 * 9. Leaflet marker icon fix kept; tile URL unchanged
 * 10. Leaflet pathOptions use hard hex (Leaflet can't read CSS vars)
 *
 * FOR HTTPS WITHOUT A TRUSTED CERT — choose one approach:
 *   A) npx localtunnel --port 3000   → https://xxxx.loca.lt
 *   B) npx ngrok http 3000           → https://xxxx.ngrok.io
 *   C) Vite: server: { https: true } + mkcert
 *   D) Deploy to Vercel/Netlify — permanent HTTPS, zero config
 */

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { MapContainer, TileLayer, Polyline, Marker, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  loadWeight, saveWeight,
  loadSessions, addSession,
  loadActiveSession, saveActiveSession, clearActiveSession,
  calcRouteDistance, calcCalories, generateId,
} from '../data/strideService';

// ─── Design tokens (single source of truth — inject once as CSS vars) ──────
const TOKENS = `
  --ink: #0A0E0D;
  --surface: #141816;
  --surface-2: #1D2220;
  --volt: #CFFF5C;
  --volt-dim: rgba(207,255,92,0.14);
  --ember: #FF5C3D;
  --ember-dim: rgba(255,92,61,0.14);
  --line: #2A302D;
  --text: #F4F6F2;
  --text-dim: #8B958F;
`;

// ─── Leaflet default icon fix (required on all bundlers) ────────────────────
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl:       'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl:     'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

// ─── iOS PWA meta tags — paste this <IOSHead /> into your root layout/index ─
export function IOSHead() {
  return (
    <>
      <meta name="apple-mobile-web-app-capable" content="yes" />
      <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
      <meta name="apple-mobile-web-app-title" content="Stride" />
      <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
      <meta name="mobile-web-app-capable" content="yes" />
      <meta name="theme-color" content="#0A0E0D" />
    </>
  );
}

// ─── GPS options — tuned for iPhone ─────────────────────────────────────────
const GEO_OPTIONS_HIGH = { enableHighAccuracy: true, timeout: 30000, maximumAge: 15000 };
const GEO_OPTIONS_LOW  = { enableHighAccuracy: false, timeout: 30000, maximumAge: 30000 };
const MAX_ACCURACY_M = 100;
const MIN_DELTA_DEG2 = 4e-9; // ~0.6 m at equator

// ─── Helpers ────────────────────────────────────────────────────────────────
function formatDuration(sec) {
  var m = Math.floor(sec / 60);
  var s = sec % 60;
  return m + ':' + (s < 10 ? '0' : '') + s;
}

function formatDate(d) {
  var diff = Date.now() - d.getTime();
  if (diff < 86400000)  return 'Today';
  if (diff < 172800000) return 'Yesterday';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// ─── Map sub-components ─────────────────────────────────────────────────────
function FitBounds({ route }) {
  var map    = useMap();
  var fitted = useRef(false);
  useEffect(function () {
    if (route.length < 2 || fitted.current) return;
    var bounds = L.latLngBounds(route.map(function (p) { return [p.lat, p.lng]; }));
    map.fitBounds(bounds, { padding: [40, 40], maxZoom: 18 });
    fitted.current = true;
  }, [route, map]);
  return null;
}

function FlyToLatest({ route }) {
  var map = useMap();
  var prevLen = useRef(0);
  useEffect(function () {
    if (route.length > prevLen.current && route.length > 0) {
      var p = route[route.length - 1];
      map.setView([p.lat, p.lng], map.getZoom(), { animate: true, duration: 0.5 });
    }
    prevLen.current = route.length;
  }, [route, map]);
  return null;
}

// ─── Effort ring — signature element ────────────────────────────────────────
// A radial progress ring that wraps icon buttons (mode toggle, record button).
// pct: 0-1 fill amount. accent: 'volt' | 'ember'.
function EffortRing({ size, pct, accent, children }) {
  var stroke = 4;
  var r = (size - stroke) / 2;
  var c = size / 2;
  var circumference = 2 * Math.PI * r;
  var offset = circumference * (1 - pct);
  var color = accent === 'ember' ? 'var(--ember)' : 'var(--volt)';
  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} style={{ position: 'absolute', top: 0, left: 0, transform: 'rotate(-90deg)' }}>
        <circle cx={c} cy={c} r={r} fill="none" stroke="var(--line)" strokeWidth={stroke} />
        <circle
          cx={c} cy={c} r={r} fill="none" stroke={color} strokeWidth={stroke}
          strokeDasharray={circumference} strokeDashoffset={offset}
          strokeLinecap="round" style={{ transition: 'stroke-dashoffset 0.4s ease' }}
        />
      </svg>
      <div style={{
        position: 'absolute', inset: stroke + 3, borderRadius: '50%',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {children}
      </div>
    </div>
  );
}

// ─── Icons (inline SVG, stroke-based, inherit color) ────────────────────────
function IconWalk(props) {
  return (
    <svg viewBox="0 0 24 24" width={props.size || 18} height={props.size || 18} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="13" cy="4" r="1.4" fill="currentColor" stroke="none" />
      <path d="M10.5 21l1.2-5-2-1.5.6-4.3L8 12l-1.5 3.5" />
      <path d="M12 10l1.8 2 2.7 1 .5 3" />
    </svg>
  );
}
function IconJog(props) {
  return (
    <svg viewBox="0 0 24 24" width={props.size || 18} height={props.size || 18} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="14.5" cy="4.2" r="1.4" fill="currentColor" stroke="none" />
      <path d="M9 21l2-4-3-2 1-4.5L6 12l-1 3" />
      <path d="M11 9.5l2 2.2 3 .8 2.5 3" />
      <path d="M13.5 12.7L16 11l3 1" />
    </svg>
  );
}
function IconPlay(props) {
  return (
    <svg viewBox="0 0 24 24" width={props.size || 22} height={props.size || 22} fill="currentColor"><path d="M7 4.5v15l13-7.5z" /></svg>
  );
}
function IconPause(props) {
  return (
    <svg viewBox="0 0 24 24" width={props.size || 20} height={props.size || 20} fill="currentColor"><rect x="6" y="4" width="4.5" height="16" rx="1" /><rect x="13.5" y="4" width="4.5" height="16" rx="1" /></svg>
  );
}
function IconStop(props) {
  return (
    <svg viewBox="0 0 24 24" width={props.size || 18} height={props.size || 18} fill="currentColor"><rect x="5" y="5" width="14" height="14" rx="2" /></svg>
  );
}
function IconChevron(props) {
  return (
    <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ transform: props.open ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.3s ease' }}>
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}
function IconPin(props) {
  return (
    <svg viewBox="0 0 24 24" width={props.size || 26} height={props.size || 26} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 21s-7-6.4-7-11.5A7 7 0 0 1 19 9.5C19 14.6 12 21 12 21z" />
      <circle cx="12" cy="9.5" r="2.4" />
    </svg>
  );
}

// ─── Shared styles ───────────────────────────────────────────────────────────
var STAT_LABEL = {
  fontSize: 10, fontWeight: 700, color: 'var(--text-dim)',
  textTransform: 'uppercase', letterSpacing: '0.12em', fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif',
};
var DISPLAY_FONT = "'Archivo Black', 'Arial Black', -apple-system, sans-serif";

function ModeSwitch({ mode, onChange, disabled }) {
  var isWalk = mode === 'walking';
  return (
    <div style={{
      position: 'relative', display: 'flex', background: 'var(--surface-2)',
      borderRadius: 16, padding: 4, border: '1px solid var(--line)',
    }}>
      <div style={{
        position: 'absolute', top: 4, bottom: 4, left: isWalk ? 4 : '50%',
        width: 'calc(50% - 4px)', borderRadius: 12,
        background: isWalk ? 'var(--volt)' : 'var(--ember)',
        transition: 'left 0.28s cubic-bezier(0.16,1,0.3,1), background 0.28s ease',
      }} />
      {['walking', 'jogging'].map(function (m) {
        var active = mode === m;
        return (
          <button
            key={m}
            disabled={disabled}
            onClick={function () { onChange(m); }}
            style={{
              position: 'relative', flex: 1, padding: '11px 0', border: 'none',
              background: 'transparent', cursor: disabled ? 'default' : 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
              fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif',
              fontWeight: 800, fontSize: 13, letterSpacing: '0.01em',
              color: active ? 'var(--ink)' : 'var(--text-dim)',
              transition: 'color 0.2s ease', zIndex: 1,
              WebkitTapHighlightColor: 'transparent',
            }}
          >
            {m === 'walking' ? <IconWalk size={16} /> : <IconJog size={16} />}
            {m === 'walking' ? 'Walk' : 'Jog'}
          </button>
        );
      })}
    </div>
  );
}

// ─── Main component ──────────────────────────────────────────────────────────
export default function StrideTracker() {
  var [mode,            setMode]            = useState('walking');
  var [trackingState,   setTrackingState]   = useState('idle');
  var [route,           setRoute]           = useState([]);
  var [elapsed,         setElapsed]         = useState(0);
  var [distance,        setDistance]        = useState(0);
  var [weight,          setWeight]          = useState(function () { return loadWeight(); });
  var [showWeight,      setShowWeight]      = useState(function () { return !loadWeight(); });
  var [sessions,        setSessions]        = useState(function () { return loadSessions(); });
  var [permissionDenied,setPermissionDenied]= useState(false);
  var [weightInput,     setWeightInput]     = useState(String(loadWeight() || 70));
  var [center,          setCenter]          = useState(null);
  var [showHistory,     setShowHistory]     = useState(false);
  var [errorMsg,        setErrorMsg]        = useState('');
  var [manualMode,      setManualMode]      = useState(false);
  var [manualDist,      setManualDist]      = useState('');
  var [manualTime,      setManualTime]      = useState('');
  var [usingLowAccuracy,setUsingLowAccuracy]= useState(false);
  var [gpsAccuracy,     setGpsAccuracy]     = useState(null);

  var watchIdRef        = useRef(null);
  var routeRef          = useRef([]);
  var startRef          = useRef(null);
  var pausedElapsedRef  = useRef(0);
  var sessionIdRef      = useRef(null);
  var sessionStartRef   = useRef(null);
  var highAccFailedRef  = useRef(false);

  useEffect(function () {
    return function () {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, []);

  useEffect(function () {
    if (trackingState !== 'tracking') return;
    var interval = setInterval(function () {
      if (startRef.current === null) return;
      var segmentSec = Math.floor((Date.now() - startRef.current) / 1000);
      setElapsed(pausedElapsedRef.current + segmentSec);
    }, 500);
    return function () { clearInterval(interval); };
  }, [trackingState]);

  var handlePosition = useCallback(function (pos) {
    setGpsAccuracy(pos.coords.accuracy);
    if (pos.coords.accuracy > MAX_ACCURACY_M) return;

    var point = { lat: pos.coords.latitude, lng: pos.coords.longitude, timestamp: pos.timestamp };

    setRoute(function (prev) {
      if (!prev.length) {
        setCenter([point.lat, point.lng]);
        routeRef.current = [point];
        return [point];
      }
      var last  = prev[prev.length - 1];
      var dLat  = point.lat - last.lat;
      var dLng  = point.lng - last.lng;
      if ((dLat * dLat + dLng * dLng) < MIN_DELTA_DEG2) return prev;
      var next = prev.concat([point]);
      routeRef.current = next;
      setDistance(calcRouteDistance(next));
      return next;
    });
  }, []);

  var handleError = useCallback(function (err) {
    if (err.code === 1) {
      setPermissionDenied(true);
      setTrackingState('idle');
      return;
    }
    if (!highAccFailedRef.current) {
      highAccFailedRef.current = true;
      setUsingLowAccuracy(true);
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
      var id = navigator.geolocation.watchPosition(handlePosition, function () {
        setErrorMsg('GPS unavailable. Check Location Services in Settings > Privacy.');
      }, GEO_OPTIONS_LOW);
      watchIdRef.current = id;
    } else {
      setErrorMsg('GPS signal lost. Will resume when signal returns.');
    }
  }, [handlePosition]);

  var startWatch = useCallback(function () {
    highAccFailedRef.current = false;
    setUsingLowAccuracy(false);
    var id = navigator.geolocation.watchPosition(handlePosition, handleError, GEO_OPTIONS_HIGH);
    watchIdRef.current = id;
  }, [handlePosition, handleError]);

  var startTracking = useCallback(function () {
    if (!navigator.geolocation) {
      setErrorMsg('Geolocation is not supported by your browser.');
      return;
    }
    if (window.location.protocol !== 'https:' && window.location.hostname !== 'localhost') {
      setErrorMsg('GPS requires HTTPS. Deploy to Vercel or use a tunnel for testing.');
      return;
    }

    setErrorMsg('');
    setPermissionDenied(false);
    setRoute([]);
    setDistance(0);
    setElapsed(0);
    routeRef.current = [];
    pausedElapsedRef.current = 0;

    var now = Date.now();
    startRef.current        = now;
    sessionStartRef.current = now;
    sessionIdRef.current    = generateId();

    startWatch();
    setTrackingState('tracking');

    saveActiveSession({ id: sessionIdRef.current, startTime: now, mode: mode, route: [] });
  }, [mode, startWatch]);

  var pauseTracking = useCallback(function () {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    var segmentSec = startRef.current ? Math.floor((Date.now() - startRef.current) / 1000) : 0;
    pausedElapsedRef.current += segmentSec;
    startRef.current = null;
    setElapsed(pausedElapsedRef.current);
    setTrackingState('paused');
  }, []);

  var resumeTracking = useCallback(function () {
    setErrorMsg('');
    setPermissionDenied(false);
    startRef.current = Date.now();
    startWatch();
    setTrackingState('tracking');
  }, [startWatch]);

  var stopTracking = useCallback(function () {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }

    var totalSec = elapsed;
    var totalKm  = calcRouteDistance(routeRef.current);
    var cal      = calcCalories(totalKm, weight, mode);

    if (routeRef.current.length > 1) {
      addSession({
        id:          sessionIdRef.current || generateId(),
        startTime:   sessionStartRef.current || Date.now(),
        endTime:     Date.now(),
        durationSec: totalSec,
        distanceKm:  totalKm,
        calories:    cal,
        mode:        mode,
        route:       routeRef.current,
      });
      setSessions(loadSessions());
    }

    clearActiveSession();
    setTrackingState('idle');
    setRoute([]);
    setDistance(0);
    setElapsed(0);
    setCenter(null);
    routeRef.current        = [];
    pausedElapsedRef.current = 0;
    startRef.current        = null;
    sessionIdRef.current    = null;
    sessionStartRef.current = null;
  }, [elapsed, weight, mode]);

  var handleSaveWeight = useCallback(function () {
    var w = Number(weightInput);
    if (isNaN(w) || w < 20 || w > 400) {
      setErrorMsg('Please enter a weight between 20 and 400 kg.');
      return;
    }
    saveWeight(w);
    setWeight(w);
    setShowWeight(false);
    setErrorMsg('');
  }, [weightInput]);

  var isTracking = trackingState === 'tracking';
  var isPaused   = trackingState === 'paused';
  var isActive   = isTracking || isPaused;
  var accent     = mode === 'jogging' ? 'ember' : 'volt';

  var displayDistance = isActive ? calcRouteDistance(route) : distance;
  var displayTime     = isActive ? formatDuration(elapsed) : '0:00';
  var displayCal      = calcCalories(displayDistance, weight, mode);

  var paceFormatted = (displayDistance > 0 && elapsed > 0)
    ? (function () {
        var minPerKm = elapsed / 60 / displayDistance;
        var m = Math.floor(minPerKm);
        var s = Math.round((minPerKm - m) * 60);
        if (s >= 60) { m += 1; s = 0; }
        return m + ':' + (s < 10 ? '0' : '') + s;
      })()
    : null;

  var polylinePositions = useMemo(function () {
    return route.map(function (p) { return [p.lat, p.lng]; });
  }, [route]);

  var sortedSessions = useMemo(function () {
    return sessions.slice().sort(function (a, b) { return (b.startTime || 0) - (a.startTime || 0); });
  }, [sessions]);

  // GPS signal quality → ring fill pct (purely decorative liveliness cue)
  var gpsPct = gpsAccuracy == null ? 0 : Math.max(0.15, Math.min(1, 1 - gpsAccuracy / 100));

  return (
    <div style={{ '--ink': '#0A0E0D', '--surface': '#141816', '--surface-2': '#1D2220',
      '--volt': '#CFFF5C', '--volt-dim': 'rgba(207,255,92,0.14)', '--ember': '#FF5C3D',
      '--ember-dim': 'rgba(255,92,61,0.14)', '--line': '#2A302D', '--text': '#F4F6F2', '--text-dim': '#8B958F',
      background: 'var(--ink)', minHeight: '100%', paddingBottom: 32,
      fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif', color: 'var(--text)',
    }}>

      {/* ── Header ── */}
      <div style={{ padding: '48px 20px 16px' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
          <h1 style={{ fontFamily: DISPLAY_FONT, fontSize: 26, margin: 0, letterSpacing: '-0.01em' }}>
            STRIDE
          </h1>
          {usingLowAccuracy && (
            <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--ember)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Low accuracy
            </span>
          )}
        </div>
        <p style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-dim)', margin: '4px 0 0' }}>
          Track your walks and jogs
        </p>
      </div>

      {/* ── Permission denied banner ── */}
      {permissionDenied && !manualMode && (
        <div style={{
          margin: '0 20px 14px', padding: '14px 16px', borderRadius: 16,
          background: 'var(--ember-dim)', border: '1px solid var(--ember)',
        }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)', lineHeight: 1.5, marginBottom: 10 }}>
            Location access denied. On iPhone: Settings &rarr; Privacy &amp; Security &rarr; Location Services &rarr; Safari &rarr; While Using
          </div>
          <button
            onClick={function () { setManualMode(true); setPermissionDenied(false); }}
            style={{
              padding: '9px 16px', borderRadius: 10, border: 'none',
              background: 'var(--ember)', color: '#1A0500', fontSize: 12,
              fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit',
              WebkitTapHighlightColor: 'transparent',
            }}
          >
            Enter manually instead
          </button>
        </div>
      )}

      {/* ── Generic error banner ── */}
      {errorMsg && !permissionDenied && (
        <div style={{
          margin: '0 20px 14px', padding: '11px 16px', borderRadius: 14,
          background: 'var(--ember-dim)', border: '1px solid var(--ember)',
          fontSize: 11, fontWeight: 600, color: 'var(--text)', lineHeight: 1.5,
        }}>
          {errorMsg}
        </div>
      )}

      {/* ── Weight entry ── */}
      {showWeight && (
        <div style={{
          margin: '0 20px 14px', padding: 18, borderRadius: 18,
          background: 'var(--surface)', border: '1px solid var(--line)',
        }}>
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>
            Enter your weight for calorie tracking
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              type="number" min="20" max="400"
              value={weightInput}
              onChange={function (e) { setWeightInput(e.target.value); }}
              onKeyDown={function (e) { if (e.key === 'Enter') handleSaveWeight(); }}
              style={{
                flex: 1, padding: '11px 14px', borderRadius: 12, border: '1px solid var(--line)',
                background: 'var(--surface-2)', fontSize: 16, fontWeight: 700,
                color: 'var(--text)', fontFamily: DISPLAY_FONT, outline: 'none',
              }}
              placeholder="70"
            />
            <button
              onClick={handleSaveWeight}
              style={{
                padding: '11px 20px', borderRadius: 12, border: 'none',
                background: 'var(--volt)', color: 'var(--ink)', fontWeight: 800,
                fontSize: 13, cursor: 'pointer', fontFamily: 'inherit',
                WebkitTapHighlightColor: 'transparent',
              }}
            >
              Save
            </button>
          </div>
        </div>
      )}

      {/* ── Map — full bleed, immersive ── */}
      <div style={{ position: 'relative', margin: '0 0 16px', height: 300, background: 'var(--surface)' }}>
        {center ? (
          <MapContainer
            key={center[0] + ',' + center[1]}
            center={center}
            zoom={18}
            style={{ height: '100%', width: '100%', filter: 'saturate(0.55) brightness(0.85) contrast(1.05)' }}
            zoomControl={false}
            attributionControl={false}
          >
            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
            {polylinePositions.length > 1 && (
              <Polyline
                positions={polylinePositions}
                pathOptions={{ color: accent === 'ember' ? '#FF5C3D' : '#CFFF5C', weight: 5, opacity: 0.95 }}
              />
            )}
            {polylinePositions.length > 0 && (
              <Marker position={polylinePositions[polylinePositions.length - 1]} />
            )}
            {polylinePositions.length > 1 && <FitBounds route={route} />}
            {isTracking && polylinePositions.length > 0 && <FlyToLatest route={route} />}
          </MapContainer>
        ) : (
          <div style={{
            height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexDirection: 'column', gap: 10,
          }}>
            <IconPin size={28} />
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-dim)' }}>
              Start a session to see your route
            </span>
          </div>
        )}
        {/* gradient fade so the stat panel reads as one continuous surface */}
        <div style={{
          position: 'absolute', left: 0, right: 0, bottom: 0, height: 56, pointerEvents: 'none',
          background: 'linear-gradient(180deg, transparent, var(--ink) 92%)',
        }} />
        {isActive && gpsAccuracy != null && (
          <div style={{
            position: 'absolute', top: 14, left: 14, display: 'flex', alignItems: 'center', gap: 6,
            background: 'rgba(10,14,13,0.75)', borderRadius: 99, padding: '6px 10px',
            border: '1px solid var(--line)',
          }}>
            <span style={{
              width: 7, height: 7, borderRadius: '50%',
              background: gpsAccuracy < 20 ? 'var(--volt)' : gpsAccuracy < 50 ? '#FFC857' : 'var(--ember)',
            }} />
            <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text)' }}>
              {gpsAccuracy < 20 ? 'Strong GPS' : gpsAccuracy < 50 ? 'Fair GPS' : 'Weak GPS'}
            </span>
          </div>
        )}
      </div>

      {/* ── Hero readout — sports-watch style ── */}
      <div style={{ margin: '0 20px 16px', textAlign: 'center' }}>
        <div style={{ ...STAT_LABEL, marginBottom: 4 }}>Distance · km</div>
        <div style={{
          fontFamily: DISPLAY_FONT, fontSize: 64, lineHeight: 0.95, letterSpacing: '-0.01em',
          color: isActive ? (accent === 'ember' ? 'var(--ember)' : 'var(--volt)') : 'var(--text)',
          transition: 'color 0.3s ease', fontVariantNumeric: 'tabular-nums',
        }}>
          {displayDistance.toFixed(2)}
        </div>
      </div>

      {/* ── Secondary stats ── */}
      <div style={{
        margin: '0 20px 18px', display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0,1fr))',
        gap: 10,
      }}>
        {[
          { label: 'Time', value: displayTime },
          { label: 'Pace /km', value: paceFormatted != null ? paceFormatted : '—' },
          { label: 'Calories', value: displayCal },
        ].map(function (s) {
          return (
            <div key={s.label} style={{
              background: 'var(--surface)', border: '1px solid var(--line)',
              borderRadius: 14, padding: '12px 8px', textAlign: 'center',
            }}>
              <div style={{
                fontFamily: DISPLAY_FONT, fontSize: 20, fontVariantNumeric: 'tabular-nums',
                marginBottom: 4,
              }}>
                {s.value}
              </div>
              <div style={STAT_LABEL}>{s.label}</div>
            </div>
          );
        })}
      </div>

      {/* ── Mode selector ── */}
      <div style={{ margin: '0 20px 18px' }}>
        <ModeSwitch mode={mode} onChange={function (m) { if (!isActive) setMode(m); }} disabled={isActive} />
      </div>

      {/* ── Manual entry panel ── */}
      {manualMode && (
        <div style={{
          margin: '0 20px 16px', padding: 18, borderRadius: 18,
          background: 'var(--surface)', border: '1px solid var(--line)',
        }}>
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 12 }}>Manual entry</div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
            <div style={{ flex: 1 }}>
              <div style={{ ...STAT_LABEL, marginBottom: 6 }}>Distance (km)</div>
              <input
                type="number" step="0.01" min="0"
                value={manualDist}
                onChange={function (e) { setManualDist(e.target.value); }}
                style={{
                  width: '100%', padding: '10px 12px', borderRadius: 10,
                  border: '1px solid var(--line)', background: 'var(--surface-2)',
                  fontSize: 16, fontWeight: 700, color: 'var(--text)',
                  fontFamily: DISPLAY_FONT, outline: 'none', boxSizing: 'border-box',
                }}
                placeholder="2.5"
              />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ ...STAT_LABEL, marginBottom: 6 }}>Duration (min)</div>
              <input
                type="number" step="1" min="0"
                value={manualTime}
                onChange={function (e) { setManualTime(e.target.value); }}
                style={{
                  width: '100%', padding: '10px 12px', borderRadius: 10,
                  border: '1px solid var(--line)', background: 'var(--surface-2)',
                  fontSize: 16, fontWeight: 700, color: 'var(--text)',
                  fontFamily: DISPLAY_FONT, outline: 'none', boxSizing: 'border-box',
                }}
                placeholder="30"
              />
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={function () {
                var d = Number(manualDist);
                var t = Number(manualTime);
                if (isNaN(d) || d <= 0 || isNaN(t) || t <= 0) {
                  setErrorMsg('Enter a valid distance and time.');
                  return;
                }
                var cal = calcCalories(d, weight, mode);
                addSession({
                  id: generateId(), startTime: Date.now(), endTime: Date.now(),
                  durationSec: t * 60, distanceKm: d, calories: cal, mode: mode, route: [],
                });
                setSessions(loadSessions());
                setManualDist('');
                setManualTime('');
                setManualMode(false);
                setErrorMsg('');
              }}
              style={{
                flex: 1, padding: '11px 0', borderRadius: 12, border: 'none',
                background: 'var(--volt)', color: 'var(--ink)', fontWeight: 800,
                fontSize: 13, cursor: 'pointer', fontFamily: 'inherit',
                WebkitTapHighlightColor: 'transparent',
              }}
            >
              Save entry
            </button>
            <button
              onClick={function () { setManualMode(false); setErrorMsg(''); }}
              style={{
                padding: '11px 18px', borderRadius: 12, border: '1px solid var(--line)',
                background: 'transparent', color: 'var(--text-dim)', fontWeight: 700,
                fontSize: 13, cursor: 'pointer', fontFamily: 'inherit',
                WebkitTapHighlightColor: 'transparent',
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* ── Control: record button with effort ring ── */}
      <div style={{ margin: '0 20px 16px', display: 'flex', justifyContent: 'center' }}>
        {trackingState === 'idle' && !manualMode && (
          <button
            onClick={startTracking}
            aria-label={'Start ' + mode}
            style={{
              border: 'none', background: 'transparent', cursor: 'pointer', padding: 0,
              WebkitTapHighlightColor: 'transparent',
            }}
          >
            <EffortRing size={88} pct={1} accent={accent}>
              <div style={{
                width: '100%', height: '100%', borderRadius: '50%',
                background: accent === 'ember' ? 'var(--ember)' : 'var(--volt)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: 'var(--ink)',
              }}>
                <IconPlay />
              </div>
            </EffortRing>
          </button>
        )}

        {isTracking && (
          <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
            <button
              onClick={pauseTracking}
              aria-label="Pause"
              style={{
                width: 56, height: 56, borderRadius: '50%', border: '1px solid var(--line)',
                background: 'var(--surface)', color: 'var(--text)', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                WebkitTapHighlightColor: 'transparent',
              }}
            >
              <IconPause />
            </button>
            <EffortRing size={88} pct={gpsPct} accent={accent}>
              <div style={{
                width: '100%', height: '100%', borderRadius: '50%',
                background: accent === 'ember' ? 'var(--ember-dim)' : 'var(--volt-dim)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: accent === 'ember' ? 'var(--ember)' : 'var(--volt)',
                fontFamily: DISPLAY_FONT, fontSize: 13,
              }}>
                LIVE
              </div>
            </EffortRing>
            <button
              onClick={stopTracking}
              aria-label="Stop"
              style={{
                width: 56, height: 56, borderRadius: '50%', border: 'none',
                background: 'var(--ember)', color: '#1A0500', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                WebkitTapHighlightColor: 'transparent',
              }}
            >
              <IconStop />
            </button>
          </div>
        )}

        {isPaused && (
          <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
            <button
              onClick={stopTracking}
              aria-label="Stop"
              style={{
                width: 56, height: 56, borderRadius: '50%', border: 'none',
                background: 'var(--ember)', color: '#1A0500', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                WebkitTapHighlightColor: 'transparent',
              }}
            >
              <IconStop />
            </button>
            <button
              onClick={resumeTracking}
              aria-label="Resume"
              style={{
                border: 'none', background: 'transparent', cursor: 'pointer', padding: 0,
                WebkitTapHighlightColor: 'transparent',
              }}
            >
              <EffortRing size={88} pct={1} accent={accent}>
                <div style={{
                  width: '100%', height: '100%', borderRadius: '50%',
                  background: accent === 'ember' ? 'var(--ember)' : 'var(--volt)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: 'var(--ink)',
                }}>
                  <IconPlay />
                </div>
              </EffortRing>
            </button>
          </div>
        )}
      </div>
      {trackingState === 'idle' && !manualMode && (
        <div style={{ textAlign: 'center', marginBottom: 8 }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            Tap to start {mode === 'walking' ? 'walking' : 'jogging'}
          </span>
        </div>
      )}

      {/* ── Session history ── */}
      {sortedSessions.length > 0 && (
        <div style={{ padding: '8px 20px 0' }}>
          <button
            onClick={function () { setShowHistory(function (v) { return !v; }); }}
            style={{
              display: 'flex', alignItems: 'center', gap: 10, width: '100%',
              background: 'none', border: 'none', cursor: 'pointer',
              padding: '12px 0', fontFamily: 'inherit',
              WebkitTapHighlightColor: 'transparent', borderTop: '1px solid var(--line)',
            }}
          >
            <span style={{ fontFamily: DISPLAY_FONT, fontSize: 14, flex: 1, textAlign: 'left' }}>
              PAST SESSIONS
            </span>
            <span style={{
              fontSize: 11, fontWeight: 800, color: 'var(--ink)',
              background: 'var(--volt)', padding: '3px 9px', borderRadius: 99,
            }}>
              {sortedSessions.length}
            </span>
            <span style={{ color: 'var(--text-dim)', display: 'flex' }}>
              <IconChevron open={showHistory} />
            </span>
          </button>

          <div style={{
            display: 'grid',
            gridTemplateRows: showHistory ? '1fr' : '0fr',
            transition: 'grid-template-rows 0.35s cubic-bezier(0.16,1,0.3,1)',
          }}>
            <div style={{ overflow: 'hidden', minHeight: 0 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingBottom: 8 }}>
                {sortedSessions.map(function (s) {
                  var d   = new Date(s.startTime);
                  var km  = s.distanceKm || calcRouteDistance(s.route || []);
                  var cal = s.calories   || calcCalories(km, weight, s.mode);
                  var dur = formatDuration(s.durationSec || 0);
                  var sAccent = s.mode === 'jogging' ? 'ember' : 'volt';
                  return (
                    <div key={s.id} style={{
                      display: 'flex', alignItems: 'center', gap: 12,
                      padding: '12px 14px', borderRadius: 14,
                      background: 'var(--surface)', border: '1px solid var(--line)',
                    }}>
                      <div style={{
                        width: 34, height: 34, borderRadius: '50%', flexShrink: 0,
                        background: sAccent === 'ember' ? 'var(--ember-dim)' : 'var(--volt-dim)',
                        color: sAccent === 'ember' ? 'var(--ember)' : 'var(--volt)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        {s.mode === 'jogging' ? <IconJog size={16} /> : <IconWalk size={16} />}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 12, fontWeight: 700 }}>{formatDate(d)}</div>
                        <div style={{ fontSize: 10, fontWeight: 500, color: 'var(--text-dim)', marginTop: 1 }}>
                          {s.mode === 'jogging' ? 'Jogging' : 'Walking'} · {dur}
                        </div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontFamily: DISPLAY_FONT, fontSize: 15 }}>{km.toFixed(2)}</div>
                        <div style={{ fontSize: 9, fontWeight: 600, color: 'var(--text-dim)' }}>
                          km · {cal} cal
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}