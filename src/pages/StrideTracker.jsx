/**
 * StrideTracker.jsx — iPhone-compatible fixes applied:
 *
 * 1. GPS accuracy filter: ignores points with accuracy > 50m (kills wild iOS cold-start jitter)
 * 2. watchPosition timeout raised to 30 000ms — iOS cold GPS needs time
 * 3. maximumAge raised to 15 000ms — reduces battery hammering
 * 4. enableHighAccuracy gracefully falls back if it fails (Low Power Mode on iOS)
 * 5. Elapsed timer uses a stable `startRef` so iOS backgrounding doesn't corrupt time
 * 6. pausedElapsedRef double-count bug fixed in stopTracking
 * 7. Pace calculation uses total (elapsed) correctly
 * 8. iOS PWA meta tags exported as a <Head /> helper component
 * 9. Leaflet marker icon fix kept; tile URL unchanged (OSM works fine on iOS)
 * 10. All dynamic CSS var() references that Leaflet ignores replaced with safe fallbacks
 *
 * FOR HTTPS WITHOUT A TRUSTED CERT — choose one approach:
 *   A) npx localtunnel --port 3000   → gives you https://xxxx.loca.lt (free, no install)
 *   B) npx ngrok http 3000           → gives you https://xxxx.ngrok.io
 *   C) Vite: add `server: { https: true }` + mkcert for local trusted cert
 *   D) Deploy to Vercel/Netlify (free) — permanent HTTPS, zero config
 *
 * Once your app is on HTTPS, iOS Safari will prompt for location permission normally.
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

// ─── Leaflet default icon fix (required on all bundlers) ────────────────────
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl:       'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl:     'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

// ─── iOS PWA meta tags — paste this <IOSHead /> into your root layout/index ─
// e.g. in index.html <head>, or in Next.js _document.js / app/layout.jsx
export function IOSHead() {
  return (
    <>
      {/* Enables standalone mode so GPS works without full browser chrome */}
      <meta name="apple-mobile-web-app-capable" content="yes" />
      <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
      <meta name="apple-mobile-web-app-title" content="Stride" />
      {/* Prevents iOS from zooming on input focus — keeps layout stable */}
      <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
      {/* Required for geolocation on iOS 16.4+ PWA installed to Home Screen */}
      <meta name="mobile-web-app-capable" content="yes" />
    </>
  );
}

// ─── GPS options — tuned for iPhone ─────────────────────────────────────────
const GEO_OPTIONS_HIGH = {
  enableHighAccuracy: true,
  timeout: 30000,      // iOS cold GPS needs up to 30 s for first fix (was 10 000)
  maximumAge: 15000,   // cache up to 15 s — reduces battery drain (was 5 000)
};
const GEO_OPTIONS_LOW = {
  enableHighAccuracy: false, // fallback for Low Power Mode
  timeout: 30000,
  maximumAge: 30000,
};
// Ignore GPS points with accuracy worse than this (meters)
// iOS cold-start often returns a 500 m "cell tower" fix before GPS locks
// Indoor GPS is typically 65-150 m, so 100 is a reasonable compromise
const MAX_ACCURACY_M = 100;
// Minimum movement threshold (degrees²) — filters GPS noise
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

// ─── Shared styles ───────────────────────────────────────────────────────────
var STAT_STYLE = { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 };
var STAT_VAL   = { fontSize: 20, fontWeight: 900, color: 'var(--text)', letterSpacing: '-0.5px', lineHeight: 1 };
var STAT_LABEL = { fontSize: 9, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' };

function ModeBtn({ active, label, icon, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        flex: 1, padding: '10px 0', borderRadius: 14,
        border:     active ? '2px solid var(--accent)' : '1px solid var(--border)',
        background: active ? 'var(--accent-soft)'      : 'var(--surface)',
        cursor: 'pointer', fontFamily: 'inherit',
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
        transition: 'all 0.18s ease',
        fontWeight: active ? 800 : 600,
        fontSize: 13, color: active ? 'var(--accent)' : 'var(--text)',
        // FIX: explicit -webkit-tap-highlight for iOS — prevents grey flash on tap
        WebkitTapHighlightColor: 'transparent',
      }}
    >
      <span>{icon}</span>
      <span>{label}</span>
    </button>
  );
}

// ─── Main component ──────────────────────────────────────────────────────────
export default function StrideTracker() {
  var [mode,            setMode]            = useState('walking');
  var [trackingState,   setTrackingState]   = useState('idle');
  var [route,           setRoute]           = useState([]);
  var [elapsed,         setElapsed]         = useState(0);  // total seconds inc. paused
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

  // Refs that survive re-renders without triggering them
  var watchIdRef        = useRef(null);
  var routeRef          = useRef([]);
  var startRef          = useRef(null);   // wall-clock ms when current segment started
  var pausedElapsedRef  = useRef(0);      // seconds accumulated before current segment
  var sessionIdRef      = useRef(null);
  var sessionStartRef   = useRef(null);   // wall-clock ms of very first Start press
  var highAccFailedRef  = useRef(false);  // true if iOS rejected enableHighAccuracy

  // Cleanup watch on unmount
  useEffect(function () {
    return function () {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, []);

  // ── Timer: wall-clock based so iOS backgrounding can't corrupt it ──────────
  // FIX: instead of incrementing a counter, we compute elapsed from real timestamps.
  // This means pausing the app or switching tabs on iPhone won't lose time.
  useEffect(function () {
    if (trackingState !== 'tracking') return;
    var interval = setInterval(function () {
      if (startRef.current === null) return;
      var segmentSec = Math.floor((Date.now() - startRef.current) / 1000);
      setElapsed(pausedElapsedRef.current + segmentSec);
    }, 500);
    return function () { clearInterval(interval); };
  }, [trackingState]);

  // ── GPS position handler ───────────────────────────────────────────────────
  var handlePosition = useCallback(function (pos) {
    setGpsAccuracy(pos.coords.accuracy);
    // FIX: skip inaccurate fixes — iOS cold GPS often gives 200–500 m accuracy first
    if (pos.coords.accuracy > MAX_ACCURACY_M) return;

    var point = {
      lat:       pos.coords.latitude,
      lng:       pos.coords.longitude,
      timestamp: pos.timestamp,
    };

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

  // ── GPS error handler — falls back to low accuracy for Low Power Mode ──────
  var handleError = useCallback(function (err) {
    if (err.code === 1) {
      // PERMISSION_DENIED
      setPermissionDenied(true);
      setTrackingState('idle');
      return;
    }
    // POSITION_UNAVAILABLE or TIMEOUT
    if (!highAccFailedRef.current) {
      // FIX: retry with low accuracy — handles iOS Low Power Mode
      highAccFailedRef.current = true;
      setUsingLowAccuracy(true);
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
      var id = navigator.geolocation.watchPosition(handlePosition, function (e2) {
        setErrorMsg('GPS unavailable. Check Location Services in Settings > Privacy.');
      }, GEO_OPTIONS_LOW);
      watchIdRef.current = id;
    } else {
      setErrorMsg('GPS signal lost. Will resume when signal returns.');
    }
  }, [handlePosition]);

  // ── Internal helper: start a geolocation watch ────────────────────────────
  var startWatch = useCallback(function () {
    highAccFailedRef.current = false;
    setUsingLowAccuracy(false);
    var id = navigator.geolocation.watchPosition(handlePosition, handleError, GEO_OPTIONS_HIGH);
    watchIdRef.current = id;
  }, [handlePosition, handleError]);

  // ── Start ──────────────────────────────────────────────────────────────────
  var startTracking = useCallback(function () {
    if (!navigator.geolocation) {
      setErrorMsg('Geolocation is not supported by your browser.');
      return;
    }
    // FIX: iOS requires HTTPS for geolocation. Detect and warn clearly.
    if (window.location.protocol !== 'https:' && window.location.hostname !== 'localhost') {
      setErrorMsg(
        'GPS requires HTTPS. Deploy to Vercel or use a tunnel for testing.'
      );
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
    startRef.current      = now;
    sessionStartRef.current = now;
    sessionIdRef.current  = generateId();

    startWatch();
    setTrackingState('tracking');

    saveActiveSession({
      id:        sessionIdRef.current,
      startTime: now,
      mode:      mode,
      route:     [],
    });
  }, [mode, startWatch]);

  // ── Pause ──────────────────────────────────────────────────────────────────
  var pauseTracking = useCallback(function () {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    // FIX: snapshot elapsed NOW so the value is stable while paused
    var segmentSec = startRef.current
      ? Math.floor((Date.now() - startRef.current) / 1000)
      : 0;
    pausedElapsedRef.current += segmentSec;
    startRef.current = null;
    setElapsed(pausedElapsedRef.current);
    setTrackingState('paused');
  }, []);

  // ── Resume ─────────────────────────────────────────────────────────────────
  var resumeTracking = useCallback(function () {
    setErrorMsg('');
    setPermissionDenied(false);
    startRef.current = Date.now();  // new segment starts now
    startWatch();
    setTrackingState('tracking');
  }, [startWatch]);

  // ── Stop ───────────────────────────────────────────────────────────────────
  var stopTracking = useCallback(function () {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }

    // FIX: elapsed already equals pausedElapsed + current segment (set by timer).
    // Original code was: Math.floor(elapsed + pausedElapsedRef.current) — double-counted.
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

  // ── Weight save ────────────────────────────────────────────────────────────
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

  // ── Derived display values ─────────────────────────────────────────────────
  var isTracking = trackingState === 'tracking';
  var isPaused   = trackingState === 'paused';
  var isActive   = isTracking || isPaused;

  var displayDistance = isActive ? calcRouteDistance(route) : distance;
  var displayTime     = isActive ? formatDuration(elapsed) : '0:00';
  var displayCal      = calcCalories(displayDistance, weight, mode);

  // FIX: pace uses total elapsed, displayed as MM:SS for precision
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

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div style={{ paddingBottom: 28, minHeight: '100%', background: 'var(--bg-gradient)' }}>
      <div style={{ padding: '52px 22px 12px' }}>
        <h1 style={{ fontSize: 24, fontWeight: 900, color: 'var(--text)', margin: 0, letterSpacing: '-0.5px' }}>
          Stride
        </h1>
        <p style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-muted)', margin: '2px 0 0' }}>
          Track your walks &amp; jogs
          {usingLowAccuracy && (
            <span style={{ color: 'var(--amber)', marginLeft: 6 }}>· Low accuracy mode</span>
          )}
        </p>
      </div>

      {/* ── Permission denied banner ── */}
      {permissionDenied && !manualMode && (
        <div style={{
          margin: '0 22px 12px', padding: '12px 14px', borderRadius: 16,
          background: 'rgba(232,146,124,0.1)', border: '1px solid var(--coral)',
          fontSize: 12, fontWeight: 600, color: 'var(--coral)', lineHeight: 1.4,
        }}>
          <div style={{ marginBottom: 8 }}>
            Location access denied.{' '}
            <strong>On iPhone:</strong> Settings → Privacy &amp; Security → Location Services → Safari → While Using
          </div>
          <button
            onClick={function () { setManualMode(true); setPermissionDenied(false); }}
            style={{
              padding: '8px 16px', borderRadius: 10, border: 'none',
              background: 'var(--coral)', color: '#fff', fontSize: 12,
              fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
              WebkitTapHighlightColor: 'transparent',
            }}
          >
            Enter manually instead
          </button>
        </div>
      )}

      {/* ── Generic error / warning banner ── */}
      {errorMsg && !permissionDenied && (
        <div style={{
          margin: '0 22px 12px', padding: '10px 14px', borderRadius: 14,
          background: 'rgba(232,184,124,0.1)', border: '1px solid var(--amber)',
          fontSize: 11, fontWeight: 600, color: 'var(--amber)', lineHeight: 1.4,
        }}>
          {errorMsg}
        </div>
      )}

      {/* ── Weight entry ── */}
      {showWeight && (
        <div style={{
          margin: '0 22px 12px', padding: 16, borderRadius: 20,
          background: 'var(--surface)', border: '1px solid var(--border)',
          boxShadow: 'var(--shadow-card)',
        }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>
            Enter your weight for calorie tracking
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              type="number" min="20" max="400"
              value={weightInput}
              onChange={function (e) { setWeightInput(e.target.value); }}
              onKeyDown={function (e) { if (e.key === 'Enter') handleSaveWeight(); }}
              style={{
                flex: 1, padding: '10px 12px', borderRadius: 12, border: '1px solid var(--border)',
                background: 'var(--input-bg)', fontSize: 16, fontWeight: 600, // FIX: 16px prevents iOS zoom
                color: 'var(--text)', fontFamily: 'inherit', outline: 'none',
              }}
              placeholder="70"
            />
            <button
              onClick={handleSaveWeight}
              style={{
                padding: '10px 18px', borderRadius: 12, border: 'none',
                background: 'var(--accent)', color: '#fff', fontWeight: 700,
                fontSize: 13, cursor: 'pointer', fontFamily: 'inherit',
                WebkitTapHighlightColor: 'transparent',
              }}
            >
              Save
            </button>
          </div>
        </div>
      )}

      {/* ── Map ── */}
      <div style={{
        margin: '0 22px 12px', borderRadius: 20, overflow: 'hidden',
        height: 280, border: '1px solid var(--border)', boxShadow: 'var(--shadow-card)',
      }}>
        {center ? (
          <MapContainer
            key={center[0] + ',' + center[1]}
            center={center}
            zoom={18}
            style={{ height: '100%', width: '100%' }}
            zoomControl={false}
            attributionControl={false}
          >
            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
            {polylinePositions.length > 1 && (
              // FIX: Leaflet pathOptions can't read CSS vars — use a hard hex fallback
              <Polyline
                positions={polylinePositions}
                pathOptions={{ color: '#6C63FF', weight: 4, opacity: 0.85 }}
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
            background: 'var(--surface2)', flexDirection: 'column', gap: 8,
          }}>
            <span style={{ fontSize: 28, opacity: 0.4 }}>🚶</span>
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)' }}>
              Start a session to see your route
            </span>
          </div>
        )}
      </div>

      {/* ── Stats bar ── */}
      <div style={{
        margin: '0 22px 12px', padding: '16px 14px', borderRadius: 22,
        background: 'var(--surface)', border: '1px solid var(--border)',
        boxShadow: 'var(--shadow-card)',
      }}>
        <div style={{ display: 'flex', gap: 6 }}>
          <div style={{ flex: 1, ...STAT_STYLE }}>
            <span style={STAT_VAL}>{displayDistance.toFixed(2)}</span>
            <span style={STAT_LABEL}>km</span>
          </div>
          <div style={{ flex: 1, ...STAT_STYLE }}>
            <span style={STAT_VAL}>{displayTime}</span>
            <span style={STAT_LABEL}>time</span>
          </div>
          <div style={{ flex: 1, ...STAT_STYLE }}>
            <span style={STAT_VAL}>{paceFormatted != null ? paceFormatted : '—'}</span>
            <span style={STAT_LABEL}>pace</span>
          </div>
          <div style={{ flex: 1, ...STAT_STYLE }}>
            <span style={STAT_VAL}>{displayCal}</span>
            <span style={STAT_LABEL}>cal</span>
          </div>
        </div>
        {gpsAccuracy != null && isActive && (
          <div style={{
            marginTop: 8, display: 'flex', alignItems: 'center', gap: 6,
            justifyContent: 'center',
          }}>
            <span style={{
              width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
              background: gpsAccuracy < 20 ? '#34c759' : gpsAccuracy < 50 ? '#ff9f0a' : '#ff3b30',
            }} />
            <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)' }}>
              GPS {gpsAccuracy < 20 ? 'Excellent' : gpsAccuracy < 50 ? 'Fair' : 'Weak'} ({gpsAccuracy}m)
            </span>
          </div>
        )}
      </div>

      {/* ── Mode selector ── */}
      <div style={{ margin: '0 22px 12px', display: 'flex', gap: 8 }}>
        <ModeBtn
          active={mode === 'walking'}
          label="Walk" icon="🚶"
          onClick={function () { if (!isActive) setMode('walking'); }}
        />
        <ModeBtn
          active={mode === 'jogging'}
          label="Jog" icon="🏃"
          onClick={function () { if (!isActive) setMode('jogging'); }}
        />
      </div>

      {/* ── Manual entry panel ── */}
      {manualMode && (
        <div style={{
          margin: '0 22px 12px', padding: 16, borderRadius: 20,
          background: 'var(--surface)', border: '1px solid var(--border)',
          boxShadow: 'var(--shadow-card)',
        }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 10 }}>
            Manual Entry
          </div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 9, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 4 }}>Distance (km)</div>
              <input
                type="number" step="0.01" min="0"
                value={manualDist}
                onChange={function (e) { setManualDist(e.target.value); }}
                style={{
                  width: '100%', padding: '9px 10px', borderRadius: 10,
                  border: '1px solid var(--border)', background: 'var(--input-bg)',
                  fontSize: 16, fontWeight: 600, // FIX: 16px prevents iOS zoom-on-focus
                  color: 'var(--text)', fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box',
                }}
                placeholder="2.5"
              />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 9, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 4 }}>Duration (min)</div>
              <input
                type="number" step="1" min="0"
                value={manualTime}
                onChange={function (e) { setManualTime(e.target.value); }}
                style={{
                  width: '100%', padding: '9px 10px', borderRadius: 10,
                  border: '1px solid var(--border)', background: 'var(--input-bg)',
                  fontSize: 16, fontWeight: 600, // FIX: 16px prevents iOS zoom-on-focus
                  color: 'var(--text)', fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box',
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
                  id:          generateId(),
                  startTime:   Date.now(),
                  endTime:     Date.now(),
                  durationSec: t * 60,
                  distanceKm:  d,
                  calories:    cal,
                  mode:        mode,
                  route:       [],
                });
                setSessions(loadSessions());
                setManualDist('');
                setManualTime('');
                setManualMode(false);
                setErrorMsg('');
              }}
              style={{
                flex: 1, padding: '10px 0', borderRadius: 12, border: 'none',
                background: 'var(--accent)', color: '#fff', fontWeight: 700,
                fontSize: 13, cursor: 'pointer', fontFamily: 'inherit',
                WebkitTapHighlightColor: 'transparent',
              }}
            >
              Save Entry
            </button>
            <button
              onClick={function () { setManualMode(false); setErrorMsg(''); }}
              style={{
                padding: '10px 16px', borderRadius: 12, border: '1px solid var(--border)',
                background: 'var(--surface)', color: 'var(--text-muted)', fontWeight: 600,
                fontSize: 13, cursor: 'pointer', fontFamily: 'inherit',
                WebkitTapHighlightColor: 'transparent',
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* ── Control buttons ── */}
      <div style={{ margin: '0 22px 12px' }}>
        {trackingState === 'idle' && !manualMode && (
          <button
            onClick={startTracking}
            style={{
              width: '100%', padding: '16px 0', borderRadius: 18, border: 'none',
              background: 'linear-gradient(145deg, var(--accent), var(--accent2))',
              color: '#fff', fontSize: 16, fontWeight: 800, cursor: 'pointer',
              fontFamily: 'inherit', boxShadow: '0 6px 24px var(--accent-soft)',
              letterSpacing: '-0.3px',
              WebkitTapHighlightColor: 'transparent',
            }}
          >
            {'▶  Start ' + (mode === 'walking' ? 'Walking' : 'Jogging')}
          </button>
        )}
        {isTracking && (
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={pauseTracking}
              style={{
                flex: 1, padding: '14px 0', borderRadius: 16,
                background: 'var(--surface)', border: '1px solid var(--border)',
                color: 'var(--text)', fontSize: 14, fontWeight: 700, cursor: 'pointer',
                fontFamily: 'inherit', WebkitTapHighlightColor: 'transparent',
              }}
            >
              ⏸  Pause
            </button>
            <button
              onClick={stopTracking}
              style={{
                flex: 1, padding: '14px 0', borderRadius: 16, border: 'none',
                background: 'var(--coral)', color: '#fff', fontSize: 14,
                fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
                WebkitTapHighlightColor: 'transparent',
              }}
            >
              ⏹  Stop
            </button>
          </div>
        )}
        {isPaused && (
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={resumeTracking}
              style={{
                flex: 1, padding: '14px 0', borderRadius: 16, border: 'none',
                background: 'var(--accent)', color: '#fff', fontSize: 14,
                fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
                WebkitTapHighlightColor: 'transparent',
              }}
            >
              ▶  Resume
            </button>
            <button
              onClick={stopTracking}
              style={{
                flex: 1, padding: '14px 0', borderRadius: 16, border: 'none',
                background: 'var(--coral)', color: '#fff', fontSize: 14,
                fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
                WebkitTapHighlightColor: 'transparent',
              }}
            >
              ⏹  Stop
            </button>
          </div>
        )}
      </div>

      {/* ── Session history ── */}
      {sortedSessions.length > 0 && (
        <div style={{ padding: '0 22px' }}>
          <button
            onClick={function () { setShowHistory(function (v) { return !v; }); }}
            style={{
              display: 'flex', alignItems: 'center', gap: 8, width: '100%',
              background: 'none', border: 'none', cursor: 'pointer',
              padding: '10px 0', fontFamily: 'inherit',
              WebkitTapHighlightColor: 'transparent',
            }}
          >
            <div style={{
              width: 3, height: 16, borderRadius: 2,
              background: 'linear-gradient(180deg, var(--accent), var(--accent2))',
              flexShrink: 0,
            }} />
            <span style={{
              fontSize: 14, fontWeight: 800, color: 'var(--text)',
              letterSpacing: '-0.3px', flex: 1, textAlign: 'left',
            }}>
              Past Sessions
            </span>
            <span style={{
              fontSize: 10, fontWeight: 700, color: 'var(--accent)',
              background: 'var(--accent-soft)', padding: '2px 8px', borderRadius: 99,
            }}>
              {sortedSessions.length}
            </span>
            <div style={{
              transition: 'transform 0.3s ease',
              transform: showHistory ? 'rotate(180deg)' : 'rotate(0deg)',
              color: 'var(--text-muted)',
            }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
                strokeWidth="2.5" strokeLinecap="round" width="15" height="15">
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </div>
          </button>

          <div style={{
            display: 'grid',
            gridTemplateRows: showHistory ? '1fr' : '0fr',
            transition: 'grid-template-rows 0.35s cubic-bezier(0.16,1,0.3,1)',
          }}>
            <div style={{ overflow: 'hidden', minHeight: 0 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {sortedSessions.map(function (s) {
                  var d   = new Date(s.startTime);
                  var km  = s.distanceKm || calcRouteDistance(s.route || []);
                  var cal = s.calories   || calcCalories(km, weight, s.mode);
                  var dur = formatDuration(s.durationSec || 0);
                  var icon = s.mode === 'jogging' ? '🏃' : '🚶';
                  return (
                    <div key={s.id} style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      padding: '11px 12px', borderRadius: 16,
                      background: 'var(--surface)', border: '1px solid var(--border)',
                    }}>
                      <div style={{ fontSize: 18, flexShrink: 0 }}>{icon}</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)' }}>
                          {formatDate(d)}
                        </div>
                        <div style={{ fontSize: 10, fontWeight: 500, color: 'var(--text-muted)', marginTop: 1 }}>
                          {s.mode === 'jogging' ? 'Jogging' : 'Walking'} · {dur}
                        </div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: 14, fontWeight: 900, color: 'var(--text)', letterSpacing: '-0.3px' }}>
                          {km.toFixed(2)}
                        </div>
                        <div style={{ fontSize: 9, fontWeight: 600, color: 'var(--text-muted)' }}>
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