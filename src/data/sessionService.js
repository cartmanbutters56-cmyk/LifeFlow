const SESSION_KEY = 'wv3_session';

export function toLocalDateKey(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function getTodayKey() {
  return toLocalDateKey(new Date());
}

function load(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw !== null ? JSON.parse(raw) : fallback;
  } catch { return fallback; }
}

function save(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
}

export function initSession() {
  const todayKey = getTodayKey();
  let session = load(SESSION_KEY, null);

  if (!session) {
    session = { currentDate: todayKey, createdAt: Date.now(), lastCheck: Date.now() };
    save(SESSION_KEY, session);
    return { isNewDay: false, previousDate: null, session };
  }

  if (session.currentDate !== todayKey) {
    const previousDate = session.currentDate;
    session = { currentDate: todayKey, createdAt: Date.now(), lastCheck: Date.now(), previousDate };
    save(SESSION_KEY, session);
    return { isNewDay: true, previousDate, session };
  }

  session.lastCheck = Date.now();
  save(SESSION_KEY, session);
  return { isNewDay: false, previousDate: null, session };
}

export function checkMidnightPassed() {
  const session = load(SESSION_KEY, null);
  if (!session) return initSession();
  const todayKey = getTodayKey();
  if (session.currentDate !== todayKey) {
    const previousDate = session.currentDate;
    session.currentDate = todayKey;
    session.lastCheck = Date.now();
    session.previousDate = previousDate;
    save(SESSION_KEY, session);
    return { isNewDay: true, previousDate, session };
  }
  session.lastCheck = Date.now();
  save(SESSION_KEY, session);
  return { isNewDay: false, previousDate: null, session };
}

export function buildWeekDates(baseDate) {
  const days = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
  const week = {};
  const now = baseDate ? new Date(baseDate) : new Date();
  const dow = now.getDay();
  const monday = new Date(now);
  monday.setDate(now.getDate() - (dow === 0 ? 6 : dow - 1));
  days.forEach((d, i) => {
    const dt = new Date(monday);
    dt.setDate(monday.getDate() + i);
    week[d] = toLocalDateKey(dt);
  });
  return week;
}

export function getDateRange(type, referenceDate) {
  const ref = referenceDate ? new Date(referenceDate) : new Date();
  const todayStr = toLocalDateKey(ref);
  const ranges = {
    daily: { start: todayStr, end: todayStr, label: 'Daily' },
    weekly: () => {
      const end = new Date(ref);
      const start = new Date(ref);
      start.setDate(ref.getDate() - 6);
      return { start: toLocalDateKey(start), end: todayStr, label: 'Weekly' };
    },
    monthly: () => {
      const end = new Date(ref);
      const start = new Date(ref);
      start.setDate(ref.getDate() - 29);
      return { start: toLocalDateKey(start), end: todayStr, label: 'Monthly' };
    },
    yearly: () => {
      const end = new Date(ref);
      const start = new Date(ref);
      start.setDate(ref.getDate() - 364);
      return { start: toLocalDateKey(start), end: todayStr, label: 'Yearly' };
    },
  };
  const range = ranges[type];
  return typeof range === 'function' ? range() : range;
}

export function getDatesInRange(startKey, endKey) {
  const dates = [];
  const start = new Date(startKey + 'T00:00:00');
  const end = new Date(endKey + 'T00:00:00');
  const current = new Date(start);
  while (current <= end) {
    dates.push(toLocalDateKey(current));
    current.setDate(current.getDate() + 1);
  }
  return dates;
}
