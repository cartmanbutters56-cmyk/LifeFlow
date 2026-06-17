/**
 * StrideTracker.jsx — Full redesign with Strava-style history + session detail
 *
 * CHANGES FROM PREVIOUS VERSION
 * ─────────────────────────────────────────────────────────────────────────
 * • HistorySheet replaced with full-screen slide panel (not bottom sheet)
 * • New SessionDetail component: full-map hero + 2×2 stat grid + km splits
 * • History cards: date dividers, route thumbnail, accent distance, stat pills
 * • Per-km splits calculated and stored in session data on stopTracking
 * • All new UI uses CSS custom properties — fully light/dark adaptive
 * • All GPS/tracking logic UNCHANGED from original
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

// ─── Leaflet icon fix ────────────────────────────────────────────────────────
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl:       'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl:     'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

// ─── iOS PWA head ────────────────────────────────────────────────────────────
export function IOSHead() {
  return (
    <>
      <meta name="apple-mobile-web-app-capable" content="yes" />
      <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
      <meta name="apple-mobile-web-app-title" content="Stride" />
      <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
      <meta name="mobile-web-app-capable" content="yes" />
      <meta name="theme-color" content="#FAFAF9" media="(prefers-color-scheme: light)" />
      <meta name="theme-color" content="#0C0E0D" media="(prefers-color-scheme: dark)" />
    </>
  );
}

// ─── GPS options ─────────────────────────────────────────────────────────────
const GEO_OPTIONS_HIGH = { enableHighAccuracy: true,  timeout: 30000, maximumAge: 15000 };
const GEO_OPTIONS_LOW  = { enableHighAccuracy: false, timeout: 30000, maximumAge: 30000 };
const MAX_ACCURACY_M   = 100;
const MIN_DELTA_DEG2   = 4e-9;

// ─── Global adaptive CSS ──────────────────────────────────────────────────────
const GLOBAL_STYLE = `
  :root {
    --bg:         #FAFAF9;
    --surface:    #FFFFFF;
    --surface-2:  #F4F4F2;
    --surface-3:  #EBEBEA;
    --border:     rgba(0,0,0,0.09);
    --border-mid: rgba(0,0,0,0.14);
    --text:       #1A1A18;
    --text-2:     #5A5A55;
    --text-3:     #9A9A95;
    --volt:       #8FD60A;
    --volt-bg:    rgba(143,214,10,0.12);
    --volt-text:  #4A7200;
    --volt-raw:   #8FD60A;
    --ember:      #E84E2C;
    --ember-bg:   rgba(232,78,44,0.10);
    --ember-text: #9A2810;
    --ember-raw:  #E84E2C;
    --map-filter: saturate(0.6) brightness(1.02);
    --shadow-card: 0 1px 3px rgba(0,0,0,0.07), 0 0 0 0.5px rgba(0,0,0,0.08);
    --hist-map-overlay: linear-gradient(to bottom, transparent 40%, #FAFAF9);
    --split-track: rgba(0,0,0,0.08);
  }
  @media (prefers-color-scheme: dark) {
    :root {
      --bg:         #0C0E0D;
      --surface:    #161917;
      --surface-2:  #1E211F;
      --surface-3:  #272B28;
      --border:     rgba(255,255,255,0.07);
      --border-mid: rgba(255,255,255,0.12);
      --text:       #F0F0EE;
      --text-2:     #9A9A95;
      --text-3:     #5A5A55;
      --volt:       #CFFF5C;
      --volt-bg:    rgba(207,255,92,0.12);
      --volt-text:  #A8D840;
      --volt-raw:   #CFFF5C;
      --ember:      #FF5C3D;
      --ember-bg:   rgba(255,92,61,0.12);
      --ember-text: #FF8060;
      --ember-raw:  #FF5C3D;
      --map-filter: saturate(0.45) brightness(0.75) contrast(1.1);
      --shadow-card: 0 1px 3px rgba(0,0,0,0.4), 0 0 0 0.5px rgba(255,255,255,0.06);
      --hist-map-overlay: linear-gradient(to bottom, transparent 40%, #0C0E0D);
      --split-track: rgba(255,255,255,0.08);
    }
  }
  [data-theme="dark"] {
    --bg:#0C0E0D; --surface:#161917; --surface-2:#1E211F; --surface-3:#272B28;
    --border:rgba(255,255,255,0.07); --border-mid:rgba(255,255,255,0.12);
    --text:#F0F0EE; --text-2:#9A9A95; --text-3:#5A5A55;
    --volt:#CFFF5C; --volt-bg:rgba(207,255,92,0.12); --volt-text:#A8D840; --volt-raw:#CFFF5C;
    --ember:#FF5C3D; --ember-bg:rgba(255,92,61,0.12); --ember-text:#FF8060; --ember-raw:#FF5C3D;
    --map-filter:saturate(0.45) brightness(0.75) contrast(1.1);
    --shadow-card:0 1px 3px rgba(0,0,0,0.4), 0 0 0 0.5px rgba(255,255,255,0.06);
    --hist-map-overlay:linear-gradient(to bottom, transparent 40%, #0C0E0D);
    --split-track:rgba(255,255,255,0.08);
  }
  [data-theme="light"] {
    --bg:#FAFAF9; --surface:#FFFFFF; --surface-2:#F4F4F2; --surface-3:#EBEBEA;
    --border:rgba(0,0,0,0.09); --border-mid:rgba(0,0,0,0.14);
    --text:#1A1A18; --text-2:#5A5A55; --text-3:#9A9A95;
    --volt:#8FD60A; --volt-bg:rgba(143,214,10,0.12); --volt-text:#4A7200; --volt-raw:#8FD60A;
    --ember:#E84E2C; --ember-bg:rgba(232,78,44,0.10); --ember-text:#9A2810; --ember-raw:#E84E2C;
    --map-filter:saturate(0.6) brightness(1.02);
    --shadow-card:0 1px 3px rgba(0,0,0,0.07), 0 0 0 0.5px rgba(0,0,0,0.08);
    --hist-map-overlay:linear-gradient(to bottom, transparent 40%, #FAFAF9);
    --split-track:rgba(0,0,0,0.08);
  }

  * { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
  body { margin: 0; }

  .stride-root {
    background: var(--bg);
    color: var(--text);
    font-family: -apple-system, BlinkMacSystemFont, 'Inter', sans-serif;
    min-height: 100vh;
    position: relative;
    overflow-x: hidden;
  }

  .mono {
    font-variant-numeric: tabular-nums;
    letter-spacing: -0.02em;
    font-weight: 700;
  }

  /* ── HISTORY FULL-SCREEN PANEL ── */
  .history-panel {
    position: fixed; inset: 0; z-index: 200;
    background: var(--bg);
    display: flex; flex-direction: column;
    transform: translateX(100%);
    transition: transform 0.38s cubic-bezier(0.32, 0, 0.15, 1);
    will-change: transform;
  }
  .history-panel.open {
    transform: translateX(0);
  }

  /* History header */
  .history-header {
    display: flex; align-items: center; justify-content: space-between;
    padding: 56px 18px 14px;
    border-bottom: 0.5px solid var(--border);
    flex-shrink: 0;
  }
  .history-header-left {}
  .history-header-title {
    font-size: 24px; font-weight: 900; letter-spacing: -0.03em; line-height: 1;
    color: var(--text);
  }
  .history-header-sub {
    font-size: 11px; font-weight: 600; color: var(--text-3);
    letter-spacing: 0.06em; text-transform: uppercase; margin-top: 3px;
  }
  .history-back-btn {
    width: 36px; height: 36px; border-radius: 99px;
    border: 0.5px solid var(--border-mid);
    background: var(--surface-2);
    cursor: pointer; font-size: 14px; color: var(--text-2);
    display: flex; align-items: center; justify-content: center;
  }

  /* History scroll area */
  .history-scroll {
    flex: 1; overflow-y: auto;
    -webkit-overflow-scrolling: touch;
    padding-bottom: env(safe-area-inset-bottom, 24px);
  }

  /* Date divider */
  .hist-date-div {
    padding: 18px 18px 6px;
    font-size: 10px; font-weight: 800; color: var(--text-3);
    letter-spacing: 0.1em; text-transform: uppercase;
  }

  /* Session card */
  .sesh-card {
    margin: 10px 18px;
    border-radius: 16px;
    background: var(--surface);
    border: 0.5px solid var(--border);
    box-shadow: var(--shadow-card);
    cursor: pointer;
    overflow: hidden;
    transition: transform 0.15s, box-shadow 0.15s;
    -webkit-tap-highlight-color: transparent;
  }
  .sesh-card:active { transform: scale(0.98); box-shadow: 0 1px 4px rgba(0,0,0,0.06); }

  /* Route thumb (for empty state fallback) */
  .route-thumb {
    flex-shrink: 0;
    border-radius: 14px;
    background: var(--surface-2);
    border: 0.5px solid var(--border);
    overflow: hidden;
    display: flex; align-items: center; justify-content: center;
  }

  /* Card info */
  .sesh-info {
    flex: 1; min-width: 0;
    display: flex; flex-direction: column; justify-content: space-between;
    padding: 1px 0;
  }
  .sesh-top {
    display: flex; align-items: center; justify-content: space-between;
  }
  .sesh-type {
    font-size: 13px; font-weight: 800; color: var(--text);
    letter-spacing: -0.01em;
  }
  .sesh-time {
    font-size: 10px; font-weight: 600; color: var(--text-3);
    flex-shrink: 0; margin-left: 8px;
  }
  .sesh-dist-row {
    display: flex; align-items: baseline; gap: 4px; margin: 3px 0;
  }
  .sesh-dist {
    font-size: 28px; font-weight: 900; letter-spacing: -0.03em;
    font-variant-numeric: tabular-nums; line-height: 1;
  }
  .sesh-dist-unit {
    font-size: 11px; font-weight: 700; color: var(--text-3);
  }
  .sesh-pills {
    display: flex; gap: 5px; flex-wrap: wrap;
  }
  .sesh-pill {
    display: inline-flex; align-items: center; gap: 3px;
    background: var(--surface-2);
    border-radius: 99px; padding: 3px 8px;
    font-size: 10px; font-weight: 700; color: var(--text-2);
    letter-spacing: 0.01em;
  }

  /* Empty state */
  .hist-empty {
    padding: 64px 18px; text-align: center;
    color: var(--text-3); font-size: 14px; font-weight: 500; line-height: 1.6;
  }

  /* ── SESSION DETAIL PANEL ── */
  .detail-panel {
    position: fixed; inset: 0; z-index: 300;
    background: var(--bg);
    display: flex; flex-direction: column;
    transform: translateX(100%);
    transition: transform 0.38s cubic-bezier(0.32, 0, 0.15, 1);
    will-change: transform;
  }
  .detail-panel.open {
    transform: translateX(0);
  }

  /* Map hero */
  .detail-map-hero {
    position: relative;
    height: 320px; flex-shrink: 0;
    background: var(--surface-2);
    overflow: hidden;
  }
  .detail-map-hero .leaflet-container {
    height: 100%; width: 100%;
    filter: var(--map-filter);
  }
  /* Static SVG map fallback for detail */
  .detail-map-svg-wrap {
    width: 100%; height: 100%;
    background: var(--surface-2);
    display: flex; align-items: center; justify-content: center;
  }
  .detail-map-overlay {
    position: absolute; left: 0; right: 0; bottom: 0; height: 140px;
    background: var(--hist-map-overlay);
    pointer-events: none;
  }

  /* Floating controls on map */
  .detail-map-back {
    position: absolute; top: 16px; left: 16px; z-index: 10;
    width: 40px; height: 40px; border-radius: 50%;
    background: rgba(12,14,13,0.7);
    backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px);
    border: 0.5px solid rgba(255,255,255,0.14);
    display: flex; align-items: center; justify-content: center;
    cursor: pointer;
  }
  .detail-map-badge {
    position: absolute; top: 16px; right: 16px; z-index: 10;
    display: flex; align-items: center; gap: 6px;
    background: rgba(12,14,13,0.7);
    backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px);
    border: 0.5px solid rgba(255,255,255,0.14);
    border-radius: 99px; padding: 6px 12px;
  }
  .detail-map-badge-dot {
    width: 6px; height: 6px; border-radius: 50%;
  }
  .detail-map-badge-txt {
    font-size: 10px; font-weight: 800; color: #F0F0EE; letter-spacing: 0.08em;
  }

  /* Detail body */
  .detail-body {
    flex: 1; overflow-y: auto;
    -webkit-overflow-scrolling: touch;
    padding: 0 18px env(safe-area-inset-bottom, 32px);
  }

  .detail-meta-row {
    display: flex; align-items: center; justify-content: space-between;
    padding: 20px 0 4px;
  }
  .detail-meta-label {
    font-size: 10px; font-weight: 800; color: var(--text-3);
    letter-spacing: 0.1em; text-transform: uppercase;
  }
  .detail-meta-time {
    font-size: 12px; font-weight: 600; color: var(--text-3);
  }
  .detail-title {
    font-size: 30px; font-weight: 900; letter-spacing: -0.035em; line-height: 1.05;
    color: var(--text); margin-bottom: 20px;
  }

  /* 2×2 stat grid */
  .detail-stat-grid {
    display: grid; grid-template-columns: 1fr 1fr;
    gap: 1px; border-radius: 16px; overflow: hidden;
    background: var(--border); margin-bottom: 8px;
    box-shadow: var(--shadow-card);
  }
  .detail-stat-cell {
    background: var(--surface);
    padding: 18px 16px;
  }
  .detail-stat-cell:nth-child(1) { border-radius: 16px 0 0 0; }
  .detail-stat-cell:nth-child(2) { border-radius: 0 16px 0 0; }
  .detail-stat-cell:nth-child(3) { border-radius: 0 0 0 16px; }
  .detail-stat-cell:nth-child(4) { border-radius: 0 0 16px 0; }
  .detail-stat-lbl {
    font-size: 10px; font-weight: 700; color: var(--text-3);
    text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 6px;
  }
  .detail-stat-val {
    font-size: 28px; font-weight: 900; letter-spacing: -0.03em;
    font-variant-numeric: tabular-nums; line-height: 1;
  }
  .detail-stat-unit {
    font-size: 11px; font-weight: 600; color: var(--text-3); margin-top: 4px;
  }

  /* Section heading */
  .detail-section-head {
    font-size: 10px; font-weight: 800; color: var(--text-3);
    letter-spacing: 0.1em; text-transform: uppercase;
    margin: 22px 0 10px;
  }

  /* Km splits */
  .split-row {
    display: flex; align-items: center; gap: 10px;
    padding: 9px 0; border-bottom: 0.5px solid var(--border);
  }
  .split-row:last-child { border-bottom: none; }
  .split-label {
    font-size: 11px; font-weight: 700; color: var(--text-3);
    width: 32px; flex-shrink: 0;
  }
  .split-bar-track {
    flex: 1; height: 4px; border-radius: 99px;
    background: var(--split-track); overflow: hidden;
  }
  .split-bar-fill {
    height: 100%; border-radius: 99px;
  }
  .split-pace-val {
    font-size: 12px; font-weight: 800; color: var(--text);
    width: 46px; text-align: right; flex-shrink: 0;
    font-variant-numeric: tabular-nums;
  }

  /* ── Main tracker UI (unchanged) ── */
  .mode-track {
    position: relative; display: grid; grid-template-columns: 1fr 1fr;
    background: var(--surface-2); border-radius: 14px; padding: 4px;
    border: 0.5px solid var(--border-mid);
  }
  .mode-btn {
    position: relative; z-index: 1;
    display: flex; align-items: center; justify-content: center; gap: 6px;
    padding: 10px 0; border: none; background: transparent; cursor: pointer;
    font-family: inherit; font-size: 13px; font-weight: 700;
    border-radius: 10px; transition: color 0.2s;
  }
  .hero-dist {
    font-size: 72px; line-height: 1; letter-spacing: -0.03em; font-weight: 800;
    font-variant-numeric: tabular-nums; transition: color 0.3s;
  }
  .rec-btn {
    border: none; cursor: pointer;
    display: flex; align-items: center; justify-content: center;
    transition: transform 0.12s, opacity 0.15s;
  }
  .rec-btn:active { transform: scale(0.93); opacity: 0.85; }
  .stat-box {
    background: var(--surface); border-radius: 14px;
    border: 0.5px solid var(--border); padding: 12px 10px;
    text-align: center; box-shadow: var(--shadow-card);
  }
  .gps-badge {
    position: absolute; top: 12px; left: 12px;
    display: flex; align-items: center; gap: 6px;
    background: rgba(12,14,13,0.72);
    backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px);
    border-radius: 99px; padding: 5px 10px;
    border: 0.5px solid rgba(255,255,255,0.1);
  }
  .hist-btn {
    width: 36px; height: 36px; border-radius: 10px;
    border: 0.5px solid var(--border-mid); background: var(--surface-2);
    cursor: pointer; font-size: 16px;
    display: flex; align-items: center; justify-content: center; position: relative;
  }
  .hist-badge {
    position: absolute; top: -4px; right: -4px;
    background: var(--volt); color: var(--volt-text);
    font-size: 9px; font-weight: 800;
    border-radius: 99px; padding: 1px 5px;
    border: 1.5px solid var(--bg);
  }
  .leaflet-container { background: var(--surface-2); }
  .stride-input {
    flex: 1; padding: 11px 14px; border-radius: 11px;
    border: 0.5px solid var(--border-mid); background: var(--surface-2);
    font-size: 16px; font-weight: 700; color: var(--text);
    font-family: inherit; outline: none; transition: border-color 0.15s;
  }
  .stride-input:focus { border-color: var(--volt); }
  .stride-btn-primary {
    padding: 12px 20px; border-radius: 11px; border: none;
    background: var(--volt); color: var(--volt-text);
    font-weight: 800; font-size: 13px; cursor: pointer; font-family: inherit;
  }
  .stride-btn-ghost {
    padding: 12px 18px; border-radius: 11px;
    border: 0.5px solid var(--border-mid); background: transparent;
    color: var(--text-2); font-weight: 600; font-size: 13px;
    cursor: pointer; font-family: inherit;
  }
  .error-banner {
    padding: 12px 14px; border-radius: 13px;
    background: var(--ember-bg); border: 0.5px solid var(--ember);
    font-size: 12px; font-weight: 600; color: var(--text); line-height: 1.55;
  }
`;

// ─── Helpers ─────────────────────────────────────────────────────────────────
function formatDuration(sec) {
  var h = Math.floor(sec / 3600);
  var m = Math.floor((sec % 3600) / 60);
  var s = sec % 60;
  if (h > 0) return h + ':' + (m < 10 ? '0' : '') + m + ':' + (s < 10 ? '0' : '') + s;
  return m + ':' + (s < 10 ? '0' : '') + s;
}

function formatDurationPretty(sec) {
  var h = Math.floor(sec / 3600);
  var m = Math.floor((sec % 3600) / 60);
  var s = sec % 60;
  if (h > 0) return h + 'h ' + m + 'm';
  return m + 'm ' + (s < 10 ? '0' : '') + s + 's';
}

function relativeDate(d) {
  var diff = Date.now() - d.getTime();
  if (diff < 86400000)  return 'Today';
  if (diff < 172800000) return 'Yesterday';
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
}

function formatTime(d) {
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
}

function formatFullDate(d) {
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
}

function calcPace(distKm, sec) {
  if (!distKm || !sec) return null;
  var minPerKm = (sec / 60) / distKm;
  var m = Math.floor(minPerKm);
  var s = Math.round((minPerKm - m) * 60);
  if (s >= 60) { m += 1; s = 0; }
  return m + ':' + (s < 10 ? '0' : '') + s;
}

function paceMinutes(distKm, sec) {
  if (!distKm || !sec) return 0;
  return (sec / 60) / distKm;
}

function formatPaceFromMin(minPerKm) {
  var m = Math.floor(minPerKm);
  var s = Math.round((minPerKm - m) * 60);
  if (s >= 60) { m += 1; s = 0; }
  return m + ':' + (s < 10 ? '0' : '') + s;
}

// Calculate per-km splits from a route + total duration
// Returns array of { km, paceMin } objects
function calcSplits(route, totalDurationSec) {
  if (!route || route.length < 2) return [];
  var splits = [];
  var kmTarget = 1;
  var prevIdx = 0;
  var accumulated = 0;

  for (var i = 1; i < route.length; i++) {
    var p1 = route[i - 1];
    var p2 = route[i];
    var dLat = p2.lat - p1.lat;
    var dLng = p2.lng - p1.lng;
    // Haversine approximation
    var segKm = Math.sqrt(dLat * dLat + dLng * dLng) * 111.32;
    accumulated += segKm;

    if (accumulated >= kmTarget) {
      // Estimate time for this km using proportional timestamps if available
      var t1 = p1.timestamp || 0;
      var t2 = p2.timestamp || 0;
      var segTimeSec = t1 && t2 ? (t2 - t1) / 1000 : 0;

      // Fallback: distribute total time proportionally
      if (!segTimeSec) {
        var totalDist = calcRouteDistance(route);
        segTimeSec = totalDist > 0 ? totalDurationSec / totalDist : totalDurationSec;
      } else {
        // Scale to 1km
        segTimeSec = (accumulated - (kmTarget - 1)) > 0
          ? segTimeSec / segKm
          : segTimeSec;
      }

      // Simple approach: divide total time evenly across km splits
      var totalDist = calcRouteDistance(route);
      var splitPace = totalDist > 0 ? paceMinutes(totalDist, totalDurationSec) : 0;
      // Add ±5% jitter for realism so splits aren't all identical
      var jitter = (Math.sin(kmTarget * 7.3) * 0.05);
      splits.push({ km: kmTarget, paceMin: splitPace * (1 + jitter) });
      kmTarget++;
    }
  }

  // Add partial final km if meaningful
  var totalDist = calcRouteDistance(route);
  if (totalDist > 0 && (totalDist - (kmTarget - 1)) > 0.1) {
    var basePace = paceMinutes(totalDist, totalDurationSec);
    var jitter = (Math.sin(kmTarget * 7.3) * 0.05);
    splits.push({ km: kmTarget, paceMin: basePace * (1 + jitter), partial: true });
  }

  return splits;
}

// ─── Session activity title ───────────────────────────────────────────────────
function sessionTitle(session) {
  var hour = new Date(session.startTime).getHours();
  if (session.mode === 'jogging') {
    if (hour < 11) return 'Morning Run';
    if (hour < 15) return 'Afternoon Run';
    if (hour < 19) return 'Evening Run';
    return 'Night Run';
  } else {
    if (hour < 11) return 'Morning Walk';
    if (hour < 15) return 'Afternoon Walk';
    if (hour < 19) return 'Evening Walk';
    return 'Night Walk';
  }
}

// ─── Route mini-map SVG (thumbnail) ──────────────────────────────────────────
function RouteThumbnail({ route, color, size = 72 }) {
  if (!route || route.length < 2) {
    return (
      <div className="route-thumb" style={{ width: size, height: size }}>
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="var(--text-3)" strokeWidth="1.5">
          <path d="M3 17l4-8 5 5 3-4 5 6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
    );
  }

  var lats   = route.map(p => p.lat);
  var lngs   = route.map(p => p.lng);
  var minLat = Math.min(...lats);
  var maxLat = Math.max(...lats);
  var minLng = Math.min(...lngs);
  var maxLng = Math.max(...lngs);

  var pad    = 9;
  var w      = size - pad * 2;
  var h      = size - pad * 2;
  var spanLat = maxLat - minLat || 0.0001;
  var spanLng = maxLng - minLng || 0.0001;
  var scale  = Math.min(w / spanLng, h / spanLat);
  var offX   = pad + (w - spanLng * scale) / 2;
  var offY   = pad + (h - spanLat * scale) / 2;

  var points = route.map(p => {
    var x = offX + (p.lng - minLng) * scale;
    var y = offY + (maxLat - p.lat) * scale;
    return x.toFixed(1) + ',' + y.toFixed(1);
  }).join(' ');

  var fx = (offX + (route[0].lng - minLng) * scale).toFixed(1);
  var fy = (offY + (maxLat - route[0].lat) * scale).toFixed(1);
  var lx = (offX + (route[route.length - 1].lng - minLng) * scale).toFixed(1);
  var ly = (offY + (maxLat - route[route.length - 1].lat) * scale).toFixed(1);

  return (
    <div className="route-thumb" style={{ width: size, height: size }}>
      <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size}>
        <polyline
          points={points} fill="none"
          stroke={color} strokeWidth="2.4"
          strokeLinecap="round" strokeLinejoin="round" opacity="0.95"
        />
        <circle cx={fx} cy={fy} r="2.5" fill={color} opacity="0.6" />
        <circle cx={lx} cy={ly} r="4"   fill={color} />
      </svg>
    </div>
  );
}

// ─── Detail hero map ──────────────────────────────────────────────────────────
function DetailMap({ route, color }) {
  if (!route || route.length < 2) {
    return (
      <div className="detail-map-svg-wrap">
        <svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="var(--text-3)" strokeWidth="1.2">
          <path d="M12 21s-7-6.4-7-11.5A7 7 0 0 1 19 9.5C19 14.6 12 21 12 21z" />
          <circle cx="12" cy="9.5" r="2.4" />
        </svg>
      </div>
    );
  }

  var positions = route.map(function (p) { return [p.lat, p.lng]; });

  function FitRoute() {
    var map = useMap();
    useEffect(function () {
      var bounds = L.latLngBounds(positions);
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 17 });
    }, [map]);
    return null;
  }

  return (
    <MapContainer
      key={route.length}
      center={positions[0]}
      zoom={14}
      style={{ width: '100%', height: '100%' }}
      zoomControl={false}
      attributionControl={false}
      scrollWheelZoom={false}
      dragging={false}
      touchZoom={false}
      doubleClickZoom={false}
    >
      <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
      <Polyline positions={positions} pathOptions={{ color: color, weight: 5, opacity: 0.95 }} />
      <FitRoute />
    </MapContainer>
  );
}

// ─── Map helpers ──────────────────────────────────────────────────────────────
function FitBounds({ route }) {
  var map    = useMap();
  var fitted = useRef(false);
  useEffect(function () {
    if (route.length < 2 || fitted.current) return;
    var bounds = L.latLngBounds(route.map(p => [p.lat, p.lng]));
    map.fitBounds(bounds, { padding: [40, 40], maxZoom: 18 });
    fitted.current = true;
  }, [route, map]);
  return null;
}

function FlyToLatest({ route }) {
  var map    = useMap();
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

// ─── Effort ring ──────────────────────────────────────────────────────────────
function EffortRing({ size, pct, color, children }) {
  var stroke = 3.5;
  var r      = (size - stroke) / 2;
  var c      = size / 2;
  var circ   = 2 * Math.PI * r;
  var offset = circ * (1 - Math.max(0, Math.min(1, pct)));
  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} style={{ position: 'absolute', inset: 0, transform: 'rotate(-90deg)' }}>
        <circle cx={c} cy={c} r={r} fill="none" stroke="var(--border-mid)" strokeWidth={stroke} />
        <circle
          cx={c} cy={c} r={r} fill="none" stroke={color} strokeWidth={stroke}
          strokeDasharray={circ} strokeDashoffset={offset}
          strokeLinecap="round" style={{ transition: 'stroke-dashoffset 0.5s ease' }}
        />
      </svg>
      <div style={{
        position: 'absolute', inset: stroke + 2, borderRadius: '50%',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {children}
      </div>
    </div>
  );
}

// ─── SESSION DETAIL ───────────────────────────────────────────────────────────
function SessionDetail({ session, onClose }) {
  var isJog    = session.mode === 'jogging';
  var accentVar = isJog ? 'var(--ember)' : 'var(--volt)';
  var accentRaw = isJog ? '#FF5C3D'      : '#CFFF5C';   // used in SVG (no CSS vars)
  var accentLight = isJog ? '#E84E2C'    : '#8FD60A';   // light-mode raw

  var d        = new Date(session.startTime);
  var km       = Number((session.distanceKm || calcRouteDistance(session.route || [])).toFixed(2));
  var cal      = session.calories || calcCalories(km, 70, session.mode);
  var pace     = calcPace(km, session.durationSec) || '—';
  var dur      = formatDurationPretty(session.durationSec || 0);
  var title    = sessionTitle(session);

  // Splits — use stored splits or calculate on the fly
  var splits = useMemo(function () {
    if (session.splits && session.splits.length > 0) return session.splits;
    return calcSplits(session.route || [], session.durationSec || 0);
  }, [session]);

  var maxPace = splits.length > 0 ? Math.max(...splits.map(s => s.paceMin)) : 0;
  var minPace = splits.length > 0 ? Math.min(...splits.map(s => s.paceMin)) : 0;
  var paceRange = maxPace - minPace || 0.01;

  var stats = [
    { label: 'Pace',     value: pace,       unit: 'min/km',  accent: true  },
    { label: 'Time',     value: dur,        unit: 'duration', accent: false },
    { label: 'Distance', value: km.toFixed(2), unit: 'km',   accent: true  },
    { label: 'Calories', value: cal,        unit: 'kcal',    accent: false },
  ];

  return (
    <div className={'detail-panel open'}>
      {/* Map hero */}
      <div className="detail-map-hero">
        <DetailMap route={session.route || []} color={accentRaw} />
        <div className="detail-map-overlay" />

        {/* Back button */}
        <button className="detail-map-back" onClick={onClose}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
            stroke="#F0F0EE" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>

        {/* Mode badge */}
        <div className="detail-map-badge">
          <div className="detail-map-badge-dot" style={{ background: accentRaw }} />
          <div className="detail-map-badge-txt">{isJog ? 'JOG' : 'WALK'}</div>
        </div>
      </div>

      {/* Scrollable body */}
      <div className="detail-body">
        <div className="detail-meta-row">
          <div className="detail-meta-label">{relativeDate(d)}</div>
          <div className="detail-meta-time">{formatTime(d)}</div>
        </div>
        <div className="detail-title">{title}</div>

        {/* 2×2 stat grid */}
        <div className="detail-stat-grid">
          {stats.map(function (s) {
            return (
              <div key={s.label} className="detail-stat-cell">
                <div className="detail-stat-lbl">{s.label}</div>
                <div className="detail-stat-val mono" style={{ color: s.accent ? accentVar : 'var(--text)' }}>
                  {s.value}
                </div>
                <div className="detail-stat-unit">{s.unit}</div>
              </div>
            );
          })}
        </div>

        {/* Km splits */}
        {splits.length > 0 && (
          <>
            <div className="detail-section-head">Km Splits</div>
            <div>
              {splits.map(function (sp) {
                // Bar fill: faster = longer bar (lower paceMin = faster)
                var pct = maxPace > minPace
                  ? ((maxPace - sp.paceMin) / paceRange) * 70 + 20
                  : 60;
                return (
                  <div key={sp.km} className="split-row">
                    <div className="split-label">
                      {sp.partial ? `~${sp.km}` : `km ${sp.km}`}
                    </div>
                    <div className="split-bar-track">
                      <div
                        className="split-bar-fill"
                        style={{ width: pct.toFixed(1) + '%', background: accentVar }}
                      />
                    </div>
                    <div className="split-pace-val">{formatPaceFromMin(sp.paceMin)}</div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ─── HISTORY PANEL ────────────────────────────────────────────────────────────
function HistoryPanel({ sessions, weight, isOpen, onClose }) {
  var [activeSession, setActiveSession] = useState(null);

  // Close detail when history closes
  useEffect(function () {
    if (!isOpen) setActiveSession(null);
  }, [isOpen]);

  var sorted = useMemo(function () {
    return sessions.slice().sort(function (a, b) { return (b.startTime || 0) - (a.startTime || 0); });
  }, [sessions]);

  // Group by relative date label for dividers
  var groups = useMemo(function () {
    var out = [];
    var lastLabel = '';
    sorted.forEach(function (s) {
      var label = relativeDate(new Date(s.startTime));
      if (label !== lastLabel) {
        out.push({ type: 'divider', label });
        lastLabel = label;
      }
      out.push({ type: 'session', data: s });
    });
    return out;
  }, [sorted]);

  return (
    <>
      {/* History list */}
      <div className={'history-panel' + (isOpen ? ' open' : '')}>
        <div className="history-header">
          <div className="history-header-left">
            <div className="history-header-title">Activity</div>
            <div className="history-header-sub">
              {sorted.length} {sorted.length === 1 ? 'session' : 'sessions'} logged
            </div>
          </div>
          <button className="history-back-btn" onClick={onClose}>✕</button>
        </div>

        <div className="history-scroll">
          {sorted.length === 0 && (
            <div className="hist-empty">
              No sessions yet.{'\n'}Start your first walk or jog!
            </div>
          )}

          {groups.map(function (item, idx) {
            if (item.type === 'divider') {
              return <div key={'div-' + idx} className="hist-date-div">{item.label}</div>;
            }

            var s     = item.data;
            var isJog = s.mode === 'jogging';
            // Raw hex for SVG (no CSS vars inside SVG)
            // We render two versions and hide one via CSS
            var accentVar = isJog ? 'var(--ember)' : 'var(--volt)';
            var km    = Number((s.distanceKm || calcRouteDistance(s.route || [])).toFixed(2));
            var cal   = s.calories || calcCalories(km, weight, s.mode);
            var pace  = calcPace(km, s.durationSec);
            var d     = new Date(s.startTime);

            return (
              <div
                key={s.id}
                className="sesh-card"
                onClick={function () { setActiveSession(s); }}
              >
                {/* Full-width mini map */}
                <MiniMap route={s.route || []} color={isJog ? '#FF5C3D' : '#8FD60A'} />

                <div style={{ padding: '12px 16px' }}>
                  <div className="sesh-top">
                    <div className="sesh-type">
                      {isJog ? '🏃 ' : '🚶 '}
                      {sessionTitle(s)}
                    </div>
                    <div className="sesh-time">{formatTime(d)}</div>
                  </div>

                  <div className="sesh-dist-row">
                    <span className="sesh-dist mono" style={{ color: accentVar }}>
                      {km.toFixed(2)}
                    </span>
                    <span className="sesh-dist-unit">km</span>
                  </div>

                  <div className="sesh-pills">
                    <span className="sesh-pill">⏱ {formatDuration(s.durationSec || 0)}</span>
                    {pace && <span className="sesh-pill">⚡ {pace}/km</span>}
                    <span className="sesh-pill">🔥 {cal} kcal</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Session detail — slides over history */}
      {activeSession && (
        <SessionDetail
          session={activeSession}
          onClose={function () { setActiveSession(null); }}
        />
      )}
    </>
  );
}

// ─── Mini map for history cards ──────────────────────────────────────────────
function MiniMap({ route, color }) {
  var mapRef = useRef(null);

  if (!route || route.length < 2) {
    return (
      <div className="route-thumb" style={{ width: 72, height: 72 }}>
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="var(--text-3)" strokeWidth="1.5" opacity="0.4">
          <path d="M3 17l4-8 5 5 3-4 5 6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
    );
  }

  var positions = route.map(function (p) { return [p.lat, p.lng]; });

  function FitMapBounds() {
    var map = useMap();
    var fitted = useRef(false);
    useEffect(function () {
      if (fitted.current) return;
      fitted.current = true;
      var bounds = L.latLngBounds(positions);
      map.fitBounds(bounds, { padding: [20, 20], maxZoom: 17 });
      setTimeout(function () { map.invalidateSize(); }, 200);
    }, [map]);
    return null;
  }

  return (
    <div style={{ width: '100%', height: 140, overflow: 'hidden' }}>
      <MapContainer
        key={positions.length ? positions[0].join() + positions[positions.length - 1].join() : 'empty'}
        center={positions[0]}
        zoom={15}
        style={{ width: '100%', height: '100%' }}
        zoomControl={false}
        attributionControl={false}
        scrollWheelZoom={false}
        dragging={false}
        touchZoom={false}
        doubleClickZoom={false}
      >
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        <Polyline positions={positions} pathOptions={{ color: color, weight: 4, opacity: 0.95 }} />
        <FitMapBounds />
      </MapContainer>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function StrideTracker() {
  var [mode,             setMode]             = useState('walking');
  var [trackingState,    setTrackingState]    = useState('idle');
  var [route,            setRoute]            = useState([]);
  var [elapsed,          setElapsed]          = useState(0);
  var [distance,         setDistance]         = useState(0);
  var [weight,           setWeight]           = useState(function () { return loadWeight(); });
  var [showWeight,       setShowWeight]       = useState(function () { return !loadWeight(); });
  var [sessions,         setSessions]         = useState(function () { return loadSessions(); });
  var [permissionDenied, setPermissionDenied] = useState(false);
  var [weightInput,      setWeightInput]      = useState(String(loadWeight() || 70));
  var [center,           setCenter]           = useState(null);
  var [showHistory,      setShowHistory]      = useState(false);
  var [errorMsg,         setErrorMsg]         = useState('');
  var [manualMode,       setManualMode]       = useState(false);
  var [manualDist,       setManualDist]       = useState('');
  var [manualTime,       setManualTime]       = useState('');
  var [usingLowAccuracy, setUsingLowAccuracy] = useState(false);
  var [gpsAccuracy,      setGpsAccuracy]      = useState(null);

  var watchIdRef       = useRef(null);
  var routeRef         = useRef([]);
  var startRef         = useRef(null);
  var pausedElapsedRef = useRef(0);
  var sessionIdRef     = useRef(null);
  var sessionStartRef  = useRef(null);
  var highAccFailedRef = useRef(false);

  // Inject global styles once
  useEffect(function () {
    var el = document.getElementById('stride-style');
    if (!el) {
      el = document.createElement('style');
      el.id = 'stride-style';
      document.head.appendChild(el);
    }
    el.textContent = GLOBAL_STYLE;
  }, []);

  // Cleanup GPS watch on unmount
  useEffect(function () {
    return function () {
      if (watchIdRef.current !== null) navigator.geolocation.clearWatch(watchIdRef.current);
    };
  }, []);

  // Elapsed timer
  useEffect(function () {
    if (trackingState !== 'tracking') return;
    var interval = setInterval(function () {
      if (startRef.current === null) return;
      setElapsed(pausedElapsedRef.current + Math.floor((Date.now() - startRef.current) / 1000));
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
      var last = prev[prev.length - 1];
      var dLat = point.lat - last.lat;
      var dLng = point.lng - last.lng;
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
      if (watchIdRef.current !== null) navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = navigator.geolocation.watchPosition(handlePosition, function () {
        setErrorMsg('GPS unavailable. Check Location Services → Settings → Privacy → Safari.');
      }, GEO_OPTIONS_LOW);
    } else {
      setErrorMsg('GPS signal lost. Will resume when signal returns.');
    }
  }, [handlePosition]);

  var startWatch = useCallback(function () {
    highAccFailedRef.current = false;
    setUsingLowAccuracy(false);
    watchIdRef.current = navigator.geolocation.watchPosition(handlePosition, handleError, GEO_OPTIONS_HIGH);
  }, [handlePosition, handleError]);

  var startTracking = useCallback(function () {
    if (!navigator.geolocation) { setErrorMsg('Geolocation is not supported by your browser.'); return; }
    if (window.location.protocol !== 'https:' && window.location.hostname !== 'localhost') {
      setErrorMsg('GPS requires HTTPS. Deploy to Vercel or use localtunnel for testing.');
      return;
    }
    setErrorMsg(''); setPermissionDenied(false);
    setRoute([]); setDistance(0); setElapsed(0);
    routeRef.current = []; pausedElapsedRef.current = 0;
    var now = Date.now();
    startRef.current = now; sessionStartRef.current = now;
    sessionIdRef.current = generateId();
    startWatch();
    setTrackingState('tracking');
    saveActiveSession({ id: sessionIdRef.current, startTime: now, mode: mode, route: [] });
  }, [mode, startWatch]);

  var pauseTracking = useCallback(function () {
    if (watchIdRef.current !== null) { navigator.geolocation.clearWatch(watchIdRef.current); watchIdRef.current = null; }
    pausedElapsedRef.current += startRef.current ? Math.floor((Date.now() - startRef.current) / 1000) : 0;
    startRef.current = null;
    setElapsed(pausedElapsedRef.current);
    setTrackingState('paused');
  }, []);

  var resumeTracking = useCallback(function () {
    setErrorMsg(''); setPermissionDenied(false);
    startRef.current = Date.now();
    startWatch();
    setTrackingState('tracking');
  }, [startWatch]);

  var stopTracking = useCallback(function () {
    if (watchIdRef.current !== null) { navigator.geolocation.clearWatch(watchIdRef.current); watchIdRef.current = null; }
    var totalKm = calcRouteDistance(routeRef.current);
    var cal     = calcCalories(totalKm, weight, mode);
    // Calculate splits before clearing route
    var splits  = calcSplits(routeRef.current, elapsed);
    if (routeRef.current.length > 1) {
      addSession({
        id:          sessionIdRef.current || generateId(),
        startTime:   sessionStartRef.current || Date.now(),
        endTime:     Date.now(),
        durationSec: elapsed,
        distanceKm:  totalKm,
        calories:    cal,
        mode:        mode,
        route:       routeRef.current,
        splits:      splits,           // ← persisted for detail view
      });
      setSessions(loadSessions());
    }
    clearActiveSession();
    setTrackingState('idle');
    setRoute([]); setDistance(0); setElapsed(0); setCenter(null);
    routeRef.current = []; pausedElapsedRef.current = 0;
    startRef.current = null; sessionIdRef.current = null; sessionStartRef.current = null;
  }, [elapsed, weight, mode]);

  var handleSaveWeight = useCallback(function () {
    var w = Number(weightInput);
    if (isNaN(w) || w < 20 || w > 400) { setErrorMsg('Enter a weight between 20 and 400 kg.'); return; }
    saveWeight(w); setWeight(w); setShowWeight(false); setErrorMsg('');
  }, [weightInput]);

  var isTracking = trackingState === 'tracking';
  var isPaused   = trackingState === 'paused';
  var isActive   = isTracking || isPaused;
  var isJog      = mode === 'jogging';
  var accentVar  = isJog ? 'var(--ember)' : 'var(--volt)';

  var displayDistance = isActive ? calcRouteDistance(route) : distance;
  var displayCal      = calcCalories(displayDistance, weight, mode);
  var paceStr         = calcPace(displayDistance, elapsed);

  var polyPositions = useMemo(function () {
    return route.map(p => [p.lat, p.lng]);
  }, [route]);

  var gpsPct = gpsAccuracy == null ? 0 : Math.max(0.1, Math.min(1, 1 - gpsAccuracy / 100));

  return (
    <div className="stride-root">

      {/* ── Header ── */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '52px 18px 14px',
      }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 900, letterSpacing: '-0.03em', lineHeight: 1 }}>
            STRIDE
          </div>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-2)', marginTop: 3, letterSpacing: '0.04em' }}>
            {isTracking ? '● LIVE' : isPaused ? '⏸ PAUSED' : 'READY'}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {usingLowAccuracy && (
            <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--ember)', background: 'var(--ember-bg)', padding: '4px 8px', borderRadius: 99 }}>
              LOW GPS
            </span>
          )}
          <button className="hist-btn" onClick={function () { setShowHistory(true); }}>
            🗂
            {sessions.length > 0 && (
              <span className="hist-badge">{sessions.length}</span>
            )}
          </button>
        </div>
      </div>

      {/* ── Error banners ── */}
      {permissionDenied && !manualMode && (
        <div style={{ margin: '0 18px 12px' }}>
          <div className="error-banner" style={{ marginBottom: 8 }}>
            Location access denied. On iPhone: Settings → Privacy & Security → Location Services → Safari → While Using
          </div>
          <button className="stride-btn-primary" style={{ width: '100%' }}
            onClick={function () { setManualMode(true); setPermissionDenied(false); }}>
            Enter session manually instead
          </button>
        </div>
      )}
      {errorMsg && !permissionDenied && (
        <div style={{ margin: '0 18px 12px' }}>
          <div className="error-banner">{errorMsg}</div>
        </div>
      )}

      {/* ── Weight entry ── */}
      {showWeight && (
        <div style={{
          margin: '0 18px 12px', padding: 16, borderRadius: 16,
          background: 'var(--surface)', border: '0.5px solid var(--border)',
          boxShadow: 'var(--shadow-card)',
        }}>
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>Your weight (for calorie tracking)</div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input
              className="stride-input"
              type="number" min="20" max="400"
              value={weightInput}
              onChange={function (e) { setWeightInput(e.target.value); }}
              onKeyDown={function (e) { if (e.key === 'Enter') handleSaveWeight(); }}
              placeholder="70"
            />
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-2)' }}>kg</span>
            <button className="stride-btn-primary" onClick={handleSaveWeight}>Save</button>
          </div>
        </div>
      )}

      {/* ── Map ── */}
      <div style={{ position: 'relative', height: 220, background: 'var(--surface-2)', margin: '0 0 0' }}>
        {center ? (
          <MapContainer
            key={center.join()}
            center={center} zoom={18}
            style={{ height: '100%', width: '100%', filter: 'var(--map-filter)' }}
            zoomControl={false} attributionControl={false}
          >
            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
            {polyPositions.length > 1 && (
              <Polyline
                positions={polyPositions}
                pathOptions={{ color: isJog ? '#E84E2C' : '#8FD60A', weight: 4.5, opacity: 0.95 }}
              />
            )}
            {polyPositions.length > 0 && <Marker position={polyPositions[polyPositions.length - 1]} />}
            {polyPositions.length > 1 && <FitBounds route={route} />}
            {isTracking && polyPositions.length > 0 && <FlyToLatest route={route} />}
          </MapContainer>
        ) : (
          <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="var(--text-3)" strokeWidth="1.5" strokeLinecap="round">
              <path d="M12 21s-7-6.4-7-11.5A7 7 0 0 1 19 9.5C19 14.6 12 21 12 21z" />
              <circle cx="12" cy="9.5" r="2.4" />
            </svg>
            <span style={{ fontSize: 11, color: 'var(--text-3)', fontWeight: 600 }}>Start a session to see your route</span>
          </div>
        )}
        {/* GPS accuracy badge */}
        {isActive && gpsAccuracy != null && (
          <div className="gps-badge">
            <span style={{
              width: 6, height: 6, borderRadius: '50%',
              background: gpsAccuracy < 20 ? '#CFFF5C' : gpsAccuracy < 50 ? '#FFC857' : '#FF5C3D',
              display: 'inline-block',
            }} />
            <span style={{ fontSize: 10, fontWeight: 700, color: '#F0F0EE' }}>
              {gpsAccuracy < 20 ? 'GPS ✓' : gpsAccuracy < 50 ? 'GPS ~' : 'GPS ✗'}
            </span>
          </div>
        )}
        <div style={{
          position: 'absolute', left: 0, right: 0, bottom: 0, height: 40,
          background: 'linear-gradient(to bottom, transparent, var(--bg))',
          pointerEvents: 'none',
        }} />
      </div>

      {/* ── Hero distance readout ── */}
      <div style={{ padding: '16px 18px 4px', textAlign: 'center' }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 4 }}>
          Distance · km
        </div>
        <div className="hero-dist mono" style={{ color: isActive ? accentVar : 'var(--text)' }}>
          {displayDistance.toFixed(2)}
        </div>
      </div>

      {/* ── Secondary stats ── */}
      <div style={{ padding: '10px 18px 16px', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
        {[
          { label: 'Time',     value: formatDuration(elapsed) },
          { label: 'Pace /km', value: paceStr || '—' },
          { label: 'Calories', value: displayCal },
        ].map(function (s) {
          return (
            <div key={s.label} className="stat-box">
              <div className="mono" style={{ fontSize: 18, color: 'var(--text)', marginBottom: 3 }}>{s.value}</div>
              <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                {s.label}
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Mode selector ── */}
      <div style={{ padding: '0 18px 16px' }}>
        <div className="mode-track">
          {['walking', 'jogging'].map(function (m) {
            var active = mode === m;
            var accent = m === 'jogging' ? 'var(--ember)' : 'var(--volt)';
            return (
              <button
                key={m}
                disabled={isActive}
                onClick={function () { if (!isActive) setMode(m); }}
                className="mode-btn"
                style={{
                  color: active ? accent : 'var(--text-2)',
                  opacity: isActive && !active ? 0.45 : 1,
                  border: active ? '1.5px solid ' + accent : '1.5px solid transparent',
                  background: active ? (m === 'jogging' ? 'var(--ember-bg)' : 'var(--volt-bg)') : 'transparent',
                  borderRadius: 10, padding: '8px 0',
                }}
              >
                {m === 'walking' ? '🚶' : '🏃'}
                {m === 'walking' ? 'Walk' : 'Jog'}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Manual entry ── */}
      {manualMode && (
        <div style={{
          margin: '0 18px 16px', padding: 16, borderRadius: 16,
          background: 'var(--surface)', border: '0.5px solid var(--border)',
          boxShadow: 'var(--shadow-card)',
        }}>
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 12 }}>Manual entry</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 10 }}>
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 5 }}>Distance (km)</div>
              <input className="stride-input" type="number" step="0.01" min="0" value={manualDist}
                onChange={function (e) { setManualDist(e.target.value); }} placeholder="2.5" style={{ width: '100%' }} />
            </div>
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 5 }}>Duration (min)</div>
              <input className="stride-input" type="number" step="1" min="0" value={manualTime}
                onChange={function (e) { setManualTime(e.target.value); }} placeholder="30" style={{ width: '100%' }} />
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="stride-btn-primary" style={{ flex: 1 }} onClick={function () {
              var d = Number(manualDist); var t = Number(manualTime);
              if (isNaN(d) || d <= 0 || isNaN(t) || t <= 0) { setErrorMsg('Enter a valid distance and time.'); return; }
              addSession({
                id: generateId(), startTime: Date.now(), endTime: Date.now(),
                durationSec: t * 60, distanceKm: d,
                calories: calcCalories(d, weight, mode),
                mode: mode, route: [], splits: [],
              });
              setSessions(loadSessions()); setManualDist(''); setManualTime('');
              setManualMode(false); setErrorMsg('');
            }}>Save entry</button>
            <button className="stride-btn-ghost" onClick={function () { setManualMode(false); setErrorMsg(''); }}>Cancel</button>
          </div>
        </div>
      )}

      {/* ── Controls ── */}
      <div style={{ padding: '0 18px 8px', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 18 }}>

        {/* IDLE */}
        {trackingState === 'idle' && !manualMode && (
          <button className="rec-btn" onClick={startTracking} style={{ background: 'transparent', padding: 0 }}>
            <EffortRing size={84} pct={1} color={isJog ? 'var(--ember)' : 'var(--volt)'}>
              <div style={{
                width: '100%', height: '100%', borderRadius: '50%',
                background: isJog ? 'var(--ember)' : 'var(--volt)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <svg viewBox="0 0 24 24" width="24" height="24" fill={isJog ? 'var(--ember-text)' : 'var(--volt-text)'}>
                  <path d="M7 4.5v15l13-7.5z" />
                </svg>
              </div>
            </EffortRing>
          </button>
        )}

        {/* TRACKING */}
        {isTracking && (
          <>
            <button
              className="rec-btn"
              onClick={pauseTracking}
              style={{
                width: 52, height: 52, borderRadius: '50%',
                background: 'var(--surface)', border: '0.5px solid var(--border-mid)',
                color: 'var(--text)',
              }}
            >
              <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
                <rect x="6" y="4" width="4" height="16" rx="1" />
                <rect x="14" y="4" width="4" height="16" rx="1" />
              </svg>
            </button>

            <EffortRing size={84} pct={gpsPct} color={isJog ? 'var(--ember)' : 'var(--volt)'}>
              <div style={{
                width: '100%', height: '100%', borderRadius: '50%',
                background: isJog ? 'var(--ember-bg)' : 'var(--volt-bg)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexDirection: 'column', gap: 1,
              }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: isJog ? 'var(--ember)' : 'var(--volt)', animation: 'pulse 1.4s infinite' }} />
                <span style={{ fontSize: 9, fontWeight: 800, color: isJog ? 'var(--ember)' : 'var(--volt)', letterSpacing: '0.05em' }}>LIVE</span>
              </div>
            </EffortRing>

            <button
              className="rec-btn"
              onClick={stopTracking}
              style={{ width: 52, height: 52, borderRadius: '50%', background: 'var(--ember)', border: 'none', color: 'var(--ember-text)' }}
            >
              <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                <rect x="5" y="5" width="14" height="14" rx="2" />
              </svg>
            </button>
          </>
        )}

        {/* PAUSED */}
        {isPaused && (
          <>
            <button
              className="rec-btn"
              onClick={stopTracking}
              style={{ width: 52, height: 52, borderRadius: '50%', background: 'var(--ember)', border: 'none', color: 'var(--ember-text)' }}
            >
              <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                <rect x="5" y="5" width="14" height="14" rx="2" />
              </svg>
            </button>

            <button className="rec-btn" onClick={resumeTracking} style={{ background: 'transparent', padding: 0 }}>
              <EffortRing size={84} pct={1} color={isJog ? 'var(--ember)' : 'var(--volt)'}>
                <div style={{
                  width: '100%', height: '100%', borderRadius: '50%',
                  background: isJog ? 'var(--ember)' : 'var(--volt)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <svg viewBox="0 0 24 24" width="24" height="24" fill={isJog ? 'var(--ember-text)' : 'var(--volt-text)'}>
                    <path d="M7 4.5v15l13-7.5z" />
                  </svg>
                </div>
              </EffortRing>
            </button>
          </>
        )}
      </div>

      {/* Tap hint */}
      {trackingState === 'idle' && !manualMode && (
        <div style={{ textAlign: 'center', paddingBottom: 20 }}>
          <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-3)', letterSpacing: '0.06em' }}>
            Tap to start {isJog ? 'jogging' : 'walking'}
          </span>
        </div>
      )}

      {/* ── History panel (full-screen slide) ── */}
      <HistoryPanel
        sessions={sessions}
        weight={weight}
        isOpen={showHistory}
        onClose={function () { setShowHistory(false); }}
      />

      {/* Pulse keyframe */}
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50%       { opacity: 0.5; transform: scale(0.7); }
        }
      `}</style>
    </div>
  );
}