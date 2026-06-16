const STORAGE_PREFIX = 'stride_v1_';

function getKey(suffix) {
  return STORAGE_PREFIX + suffix;
}

function secureLoad(key, fallback, validator) {
  try {
    const raw = localStorage.getItem(getKey(key));
    if (raw === null) return fallback;
    const parsed = JSON.parse(raw);
    if (validator && !validator(parsed)) return fallback;
    return parsed;
  } catch {
    return fallback;
  }
}

function secureSave(key, value) {
  try {
    localStorage.setItem(getKey(key), JSON.stringify(value));
  } catch {
    /* storage full — silently ignore */
  }
}

export function calcDistance(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function calcRouteDistance(route) {
  let total = 0;
  for (let i = 1; i < route.length; i++) {
    total += calcDistance(route[i - 1].lat, route[i - 1].lng, route[i].lat, route[i].lng);
  }
  return total;
}

export function calcCalories(distanceKm, weightKg, mode) {
  if (!weightKg || weightKg < 20) return 0;
  const factor = mode === 'jogging' ? 1.0 : 0.5;
  return Math.round(distanceKm * weightKg * factor);
}

export function loadWeight() {
  return secureLoad('weight', 70, function (v) {
    return typeof v === 'number' && v > 20 && v < 400;
  });
}

export function saveWeight(kg) {
  const num = Number(kg);
  if (isNaN(num) || num < 20 || num > 400) return false;
  secureSave('weight', Math.round(num));
  return true;
}

function isValidSession(s) {
  return (
    s && typeof s === 'object' &&
    typeof s.id === 'string' && s.id.length < 64 &&
    typeof s.startTime === 'number' && s.startTime > 1e12 && s.startTime < 2e12 &&
    typeof s.mode === 'string' &&
    (s.mode === 'walking' || s.mode === 'jogging') &&
    Array.isArray(s.route) && s.route.every(isValidPoint)
  );
}

export function loadSessions() {
  return secureLoad('sessions', [], function (arr) {
    return Array.isArray(arr) && arr.every(isValidSession);
  });
}

export function saveSessions(sessions) {
  if (!Array.isArray(sessions)) return;
  secureSave('sessions', sessions);
}

export function addSession(session) {
  if (!session) return;
  var clean = { ...session, route: sanitizeRoute(session.route) };
  if (!isValidSession(clean)) return;
  var list = loadSessions();
  list.push(clean);
  saveSessions(list);
}

export function loadActiveSession() {
  return secureLoad('active', null, function (v) {
    return v === null || isValidSession(v);
  });
}

export function saveActiveSession(session) {
  secureSave('active', session);
}

export function clearActiveSession() {
  try {
    localStorage.removeItem(getKey('active'));
  } catch { /* noop */ }
}

function isValidCoord(lat, lng) {
  return (
    typeof lat === 'number' && isFinite(lat) && lat >= -90 && lat <= 90 &&
    typeof lng === 'number' && isFinite(lng) && lng >= -180 && lng <= 180
  );
}

function isValidPoint(p) {
  return (
    p && typeof p === 'object' &&
    isValidCoord(p.lat, p.lng) &&
    typeof p.timestamp === 'number'
  );
}

export function sanitizeRoute(route) {
  if (!Array.isArray(route)) return [];
  return route.filter(isValidPoint);
}

export function generateId() {
  var ts = Date.now().toString(36);
  var rnd = Math.random().toString(36).slice(2, 8);
  return 's_' + ts + '_' + rnd;
}
