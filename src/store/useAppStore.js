import { useState, useCallback, useEffect, useRef } from 'react';
import { initSession, checkMidnightPassed, getTodayKey, toLocalDateKey, buildWeekDates } from '../data/sessionService';
import { buildDailySummaries, getStats, getStreak } from '../data/statsService';
import { doc, onSnapshot, updateDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase/config';
import { signOut } from '../firebase/auth';

const DAYS = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
const weekDates = buildWeekDates();
const OZ_TO_ML = 29.5735;
const defaultWeekPlan = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday']
  .reduce((acc, day) => ({ ...acc, [day]: { category: '', exercises: [] } }), {});

const seedChallenges = [
  { id:'ch1', title:'Hydration Hero', description:'Hit your water goal every day', icon:'💧', category:'water', color:'#06B6D4', duration:7, status:'available', startDate:null, completedDate:null, checkIns:{} },
  { id:'ch2', title:'Sugar-Free Week', description:'No added sugar for 7 days', icon:'🍎', category:'nutrition', color:'#10B981', duration:7, status:'available', startDate:null, completedDate:null, checkIns:{} },
  { id:'ch3', title:'Move Daily', description:'Exercise 30 min every day', icon:'🏃', category:'fitness', color:'#F59E0B', duration:7, status:'available', startDate:null, completedDate:null, checkIns:{} },
  { id:'ch4', title:'Meal Master', description:'Log all meals for 14 days', icon:'🥗', category:'nutrition', color:'#F43F5E', duration:14, status:'available', startDate:null, completedDate:null, checkIns:{} },
  { id:'ch5', title:'Mindful Mornings', description:'10 min meditation daily', icon:'🧘', category:'mindfulness', color:'#A78BFA', duration:14, status:'available', startDate:null, completedDate:null, checkIns:{} },
  { id:'ch6', title:'Perfect Week', description:'100% daily score for 7 days', icon:'⭐', category:'lifestyle', color:'#FBBF24', duration:7, status:'available', startDate:null, completedDate:null, checkIns:{} },
  { id:'ch7', title:'Strength Builder', description:'3 gym sessions/week for 3 weeks', icon:'💪', category:'fitness', color:'#EC4899', duration:21, status:'available', startDate:null, completedDate:null, checkIns:{} },
  { id:'ch8', title:'30-Day Champion', description:'Complete all daily tasks for 30 days', icon:'🏆', category:'lifestyle', color:'#8B5CF6', duration:30, status:'available', startDate:null, completedDate:null, checkIns:{} },
];

export function useAppStore(userId, displayName) {
  const prefix = userId ? `wv3_${userId}_` : 'wv3_';

  function load(key, fallback) {
    try {
      const raw = localStorage.getItem(prefix + key);
      return raw !== null ? JSON.parse(raw) : fallback;
    } catch { return fallback; }
  }

  function save(key, value) {
    try { localStorage.setItem(prefix + key, JSON.stringify(value)); } catch {}
  }

  const [themeMode, setThemeMode] = useState(() => load('themeMode', 'light'));
  const [profileName, setProfileName] = useState(() => load('profileName', displayName || ''));
  const [effectiveTheme, setEffectiveTheme] = useState(() => {
    const mode = load('themeMode', 'light');
    if (mode !== 'system') return mode;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  });
  const [activeTab, setActiveTab] = useState('dashboard');
  const [waterUnit, setWaterUnitState] = useState(() => load('wu', 'oz'));

  const [routines, setRoutines] = useState(() => load('routines', []));
  const [routineCompletions, setRoutineCompletions] = useState(() => load('rc', {}));
  const [meals, setMeals] = useState(() => load('meals', {}));
  const [waterGoal, setWaterGoalState] = useState(() => load('wg', 128));
  const [waterIntake, setWaterIntake] = useState(() => load('wi', {}));
  const [completionHistory, setCompletionHistory] = useState(() => load('ch', {}));
  const [waterHistory, setWaterHistory] = useState(() => load('wh', {}));
  const [calorieGoal, setCalorieGoalState] = useState(() => load('calgoal', 2000));
  const [dailySummaries, setDailySummariesState] = useState(() => load('ds', {}));
  const [challenges, setChallenges] = useState(() => {
    const data = load('challenges', null);
    if (data && data.length) return data;
    return seedChallenges;
  });
  const [gymWeekPlan, setGymWeekPlanState] = useState(() => {
    const fromNew = load('gymPlan', null);
    if (fromNew) return fromNew;
    // Migrate from old localStorage key used by the previous version
    if (userId) {
      try {
        const oldKey = `gym_${userId}_week_plan`;
        const oldRaw = localStorage.getItem(oldKey);
        if (oldRaw) {
          const oldData = JSON.parse(oldRaw);
          save('gymPlan', oldData);
          return oldData;
        }
      } catch {}
    }
    return null;
  });
  const [friendsRefreshKey, setFriendsRefreshKey] = useState(0);
  const refreshFriends = useCallback(() => setFriendsRefreshKey(k => k + 1), []);

  const [sessionInfo, setSessionInfo] = useState(() => initSession());
  const [todayKey, setTodayKey] = useState(() => getTodayKey());

  const todayDayName = DAYS[new Date().getDay() === 0 ? 6 : new Date().getDay() - 1];

  // ─── Flags ──────────────────────────────────────────────────────────────────
  // isSyncing: true while applying incoming Firestore data — prevents echo writes
  const isSyncing = useRef(false);
  // initialSyncDone: true after the first onSnapshot fires — prevents pushing
  // stale localStorage data before Firestore has caught up
  const initialSyncDone = useRef(false);
  // syncGeneration: bumped after initial sync completes so pending user changes
  // made before the first snapshot get pushed to Firestore
  const [syncGeneration, setSyncGeneration] = useState(0);

  useEffect(() => { save('themeMode', themeMode); }, [themeMode]);
  useEffect(() => { save('profileName', profileName); }, [profileName]);

  // Sync Google displayName when profileName is empty or was auto-set
  const prevDisplayName = useRef(displayName);
  useEffect(() => {
    if (displayName && displayName !== prevDisplayName.current) {
      if (!profileName || profileName === prevDisplayName.current) {
        setProfileName(displayName);
      }
    }
    prevDisplayName.current = displayName;
  }, [displayName, profileName]);
  useEffect(() => { save('wu', waterUnit); }, [waterUnit]);

  // ─── Firestore: real-time listener (replaces one-time getDoc) ───────────────
  const sessionId = useRef(null);
  const currentProfileNameRef = useRef(profileName);
  useEffect(() => { currentProfileNameRef.current = profileName; }, [profileName]);
  const routinesRef = useRef(routines);
  useEffect(() => { routinesRef.current = routines; }, [routines]);
  const gymPlanRef = useRef(gymWeekPlan);
  useEffect(() => { gymPlanRef.current = gymWeekPlan; }, [gymWeekPlan]);

  useEffect(() => {
    if (!userId) return;

    const sid = 'sess_' + Date.now() + '_' + Math.random().toString(36).slice(2, 9);
    sessionId.current = sid;
    const ref = doc(db, 'users', userId);

    // Register this session (do NOT write displayName — it's managed separately
    // via updateUserProfile to avoid overwriting the value set by another device)
    setDoc(ref, {
      currentSession: sid,
      lastSeen: serverTimestamp(),
    }, { merge: true }).catch(() => {});

    // Single real-time listener handles BOTH session management AND data sync
    const unsub = onSnapshot(ref, (snap) => {
      if (!snap.exists()) return;
      const data = snap.data();

      const isFirstSync = !initialSyncDone.current;
      initialSyncDone.current = true;
      isSyncing.current = true;

      // ── Session: kick duplicate logins ──────────────────────────────────────
      if (data.currentSession && data.currentSession !== sessionId.current) {
        isSyncing.current = false;
        signOut().catch(() => {});
        return;
      }

      // ── Profile name ────────────────────────────────────────────────────────
      if (data.displayName && data.displayName !== currentProfileNameRef.current) {
        setProfileName(data.displayName);
      }

      // ── App settings ────────────────────────────────────────────────────────
      const s = data.appSettings;
      if (s) {
        if (s.themeMode !== undefined) setThemeMode(s.themeMode);
        if (s.waterUnit !== undefined) setWaterUnitState(s.waterUnit);
        if (s.waterGoal !== undefined) setWaterGoalState(s.waterGoal);
        if (s.calorieGoal !== undefined) setCalorieGoalState(s.calorieGoal);
        if (s.challenges !== undefined) setChallenges(s.challenges);
        // For routines and gymWeekPlan, merge on first sync so local changes
        // made before the snapshot arrived are preserved alongside Firestore data
        if (s.routines !== undefined) {
          if (!isFirstSync) {
            setRoutines(s.routines);
          } else {
            setRoutines(prev => {
              if (prev.length === 0) return s.routines;
              const localIds = new Set(prev.map(r => r.id));
              const remoteOnly = s.routines.filter(r => !localIds.has(r.id));
              return [...prev, ...remoteOnly];
            });
          }
        }
        if (s.gymWeekPlan !== undefined) {
          if (!isFirstSync) {
            setGymWeekPlanState(s.gymWeekPlan);
          } else {
            setGymWeekPlanState(prev => {
              if (!prev) return s.gymWeekPlan;
              const merged = { ...s.gymWeekPlan };
              Object.entries(prev).forEach(([day, plan]) => {
                if (plan.category || plan.exercises.length) merged[day] = plan;
              });
              return merged;
            });
          }
        }
      }

      // ── Daily data ──────────────────────────────────────────────────────────
      const dd = data.dailyData;
      if (dd) {
        const dateKeys = Object.keys(dd).filter(k => /^\d{4}-\d{2}-\d{2}$/.test(k));
        if (dateKeys.length) {
          let wi = {}, m = {}, ch = {}, wh = {}, rc = {};
          dateKeys.forEach(dk => {
            const day = dd[dk];
            if (day?.waterIntake !== undefined) wi[dk] = day.waterIntake;
            if (day?.meals !== undefined) m[dk] = day.meals;
            if (day?.completionHistory !== undefined) ch[dk] = day.completionHistory;
            if (day?.waterHistory !== undefined) wh[dk] = day.waterHistory;
            if (day?.routineCompletions) Object.assign(rc, day.routineCompletions);
          });

          // Merge incoming data over local state
          if (Object.keys(wi).length) {
            if (!isFirstSync) {
              setWaterIntake(prev => ({ ...prev, ...wi }));
            } else {
              // Keep the larger intake per date so local additions aren't lost
              setWaterIntake(prev => {
                const r = { ...prev };
                Object.entries(wi).forEach(([k, v]) => { r[k] = Math.max(r[k] || 0, v); });
                return r;
              });
            }
          }
          if (Object.keys(m).length) {
            if (!isFirstSync) {
              setMeals(prev => ({ ...prev, ...m }));
            } else {
              // Keep local meals that don't exist in the remote set
              setMeals(prev => {
                const r = { ...prev };
                Object.entries(m).forEach(([dk, remoteList]) => {
                  const localList = r[dk] || [];
                  const remoteIds = new Set(remoteList.map(x => x.id));
                  r[dk] = [...remoteList, ...localList.filter(x => !remoteIds.has(x.id))];
                });
                return r;
              });
            }
          }
          if (Object.keys(ch).length) setCompletionHistory(prev => ({ ...prev, ...ch }));
          if (Object.keys(wh).length) setWaterHistory(prev => ({ ...prev, ...wh }));
          if (Object.keys(rc).length) setRoutineCompletions(prev => ({ ...prev, ...rc }));
        }
      }

      // Clear syncing flag after React flushes, then bump the generation
      // so any user changes made before initial sync get pushed to Firestore
      setTimeout(() => {
        isSyncing.current = false;
        if (isFirstSync) setSyncGeneration(g => g + 1);
      }, 0);
    }, (err) => {
      console.warn('Firestore listener error:', err);
    });

    return () => unsub();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  // ─── Firestore: push settings when they change (skip if syncing) ─────────
  useEffect(() => {
    if (!userId || isSyncing.current || !initialSyncDone.current) return;
    const ref = doc(db, 'users', userId);
    setDoc(ref, {
      appSettings: { themeMode, waterUnit, waterGoal, calorieGoal, routines, challenges, gymWeekPlan }
    }, { merge: true }).catch(() => {});
  }, [userId, themeMode, waterUnit, waterGoal, calorieGoal, routines, challenges, gymWeekPlan, syncGeneration]);

  // ─── Firestore: push daily data when it changes (skip if syncing) ────────
  useEffect(() => {
    if (!userId || isSyncing.current || !initialSyncDone.current) return;

    const allKeys = [...new Set([
      ...Object.keys(waterIntake),
      ...Object.keys(meals),
      ...Object.keys(completionHistory),
      ...Object.keys(waterHistory),
      ...Object.keys(routineCompletions).map(k => k.split('_').pop()),
    ])];
    if (!allKeys.length) return;

    const daily = {};
    allKeys.forEach(dk => {
      const entry = {};
      if (waterIntake[dk] !== undefined) entry.waterIntake = waterIntake[dk];
      if (meals[dk] !== undefined) entry.meals = meals[dk];
      if (completionHistory[dk] !== undefined) entry.completionHistory = completionHistory[dk];
      if (waterHistory[dk] !== undefined) entry.waterHistory = waterHistory[dk];
      const rcs = Object.keys(routineCompletions)
        .filter(k => k.endsWith(`_${dk}`))
        .reduce((a, k) => ({ ...a, [k]: routineCompletions[k] }), {});
      if (Object.keys(rcs).length) entry.routineCompletions = rcs;
      daily[dk] = entry;
    });

    const ref = doc(db, 'users', userId);
    setDoc(ref, { dailyData: daily }, { merge: true }).catch(() => {});
  }, [userId, waterIntake, meals, completionHistory, routineCompletions, waterHistory, syncGeneration]);

  // Apply effective theme to body
  useEffect(() => {
    document.body.setAttribute('data-theme', effectiveTheme);
  }, [effectiveTheme]);

  // Update effective theme when mode changes
  useEffect(() => {
    setEffectiveTheme(themeMode);
  }, [themeMode]);

  // One-time clear of stored routines for fresh start (global flag, never re-runs)
  useEffect(() => {
    if (localStorage.getItem('wv3_routines_cleared_global')) return;
    localStorage.setItem('wv3_routines_cleared_global', '1');
    const keys = Object.keys(localStorage).filter(k => k.endsWith('_routines') || k.endsWith('_rc'));
    keys.forEach(k => localStorage.removeItem(k));
    setRoutines([]);
    setRoutineCompletions({});
  }, []);

  useEffect(() => { save('routines', routines); }, [routines]);
  useEffect(() => { save('rc', routineCompletions); }, [routineCompletions]);
  useEffect(() => { save('meals', meals); }, [meals]);
  useEffect(() => { save('wg', waterGoal); }, [waterGoal]);
  useEffect(() => { save('wi', waterIntake); }, [waterIntake]);
  useEffect(() => { save('ch', completionHistory); }, [completionHistory]);
  useEffect(() => { save('wh', waterHistory); }, [waterHistory]);
  useEffect(() => { save('calgoal', calorieGoal); }, [calorieGoal]);
  useEffect(() => { save('challenges', challenges); }, [challenges]);
  useEffect(() => { save('gymPlan', gymWeekPlan); }, [gymWeekPlan]);
  useEffect(() => { save('ds', dailySummaries); }, [dailySummaries]);

  // ─── Midnight Detection ──────────────────────────────────────────────────────
  const midnightInterval = useRef(null);
  useEffect(() => {
    const check = () => {
      const result = checkMidnightPassed();
      if (result.isNewDay) {
        setSessionInfo(result);
        setTodayKey(getTodayKey());
      }
    };
    midnightInterval.current = setInterval(check, 30000);
    return () => clearInterval(midnightInterval.current);
  }, []);

  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        const result = checkMidnightPassed();
        if (result.isNewDay) {
          setSessionInfo(result);
          setTodayKey(getTodayKey());
        }
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, []);

  // ─── Build Daily Summaries ──────────────────────────────────────────────────
  useEffect(() => {
    const data = { waterIntake, waterGoal, meals, routineCompletions, routines, dailySummaries };
    const updated = buildDailySummaries(data);
    if (JSON.stringify(updated) !== JSON.stringify(dailySummaries)) {
      setDailySummariesState(updated);
    }
  }, [waterIntake, waterGoal, meals, routineCompletions, routines]);

  // ─── Legacy completion/water history sync ───────────────────────────────────
  useEffect(() => {
    const todayMeals = meals[todayKey] || [];
    const doneM = todayMeals.filter(m => m.done).length;
    const mealPct = todayMeals.length ? Math.round((doneM / todayMeals.length) * 100) : 0;
    const todayRs = routines.filter(r => r.days.includes(todayDayName));
    const doneR = todayRs.filter(r => !!routineCompletions[`${r.id}_${todayKey}`]).length;
    const routinePct = todayRs.length ? Math.round((doneR / todayRs.length) * 100) : 0;
    const curWater = waterIntake[todayKey] || 0;
    const waterPct = Math.min(Math.round((curWater / waterGoal) * 100), 100);
    setCompletionHistory(prev => ({
      ...prev,
      [todayKey]: { routines: routinePct, meals: mealPct, water: waterPct, routinesDone: doneR, routinesTotal: todayRs.length, mealsDone: doneM, mealsTotal: todayMeals.length }
    }));
    setWaterHistory(prev => ({ ...prev, [todayKey]: { intake: curWater, goal: waterGoal } }));
  }, [routineCompletions, meals, waterIntake, waterGoal, routines, todayDayName]);

  // ─── Theme ───────────────────────────────────────────────────────────────────
  const setTheme = useCallback((mode) => setThemeMode(mode), []);
  const cycleTheme = useCallback(() => {
    setThemeMode(m => m === 'light' ? 'dark' : 'light');
  }, []);
  const setWaterUnit = useCallback(u => setWaterUnitState(u), []);

  // ─── Routines ────────────────────────────────────────────────────────────────
  const toggleRoutine = useCallback((id, dk) => {
    const k = `${id}_${dk}`;
    setRoutineCompletions(prev => ({ ...prev, [k]: !prev[k] }));
  }, []);
  const isRoutineDone = useCallback((id, dk) => !!routineCompletions[`${id}_${dk}`], [routineCompletions]);
  const addRoutine = useCallback(r => setRoutines(prev => [...prev, { ...r, id: 'r' + Date.now() }]), []);
  const updateRoutine = useCallback((id, upd) => setRoutines(prev => prev.map(r => r.id === id ? { ...r, ...upd } : r)), []);
  const deleteRoutine = useCallback(id => setRoutines(prev => prev.filter(r => r.id !== id)), []);

  const todayRoutines = routines.filter(r => r.days.includes(todayDayName));
  const todayRoutinesDone = todayRoutines.filter(r => isRoutineDone(r.id, todayKey)).length;

  // ─── Meals ───────────────────────────────────────────────────────────────────
  const getTodayMeals = useCallback(() => meals[todayKey] || [], [meals, todayKey]);
  const toggleMeal = useCallback(mid => setMeals(prev => {
    const list = prev[todayKey] || [];
    return { ...prev, [todayKey]: list.map(m => m.id === mid ? { ...m, done: !m.done } : m) };
  }), [todayKey]);
  const addMeal = useCallback(meal => setMeals(prev => {
    const list = prev[todayKey] || [];
    return { ...prev, [todayKey]: [...list, { ...meal, id: 'm' + Date.now(), done: false, createdAt: Date.now() }] };
  }), [todayKey]);
  const deleteMeal = useCallback(mid => setMeals(prev => {
    const list = prev[todayKey] || [];
    return { ...prev, [todayKey]: list.filter(m => m.id !== mid) };
  }), [todayKey]);
  const updateMeal = useCallback((mid, updates) => setMeals(prev => {
    const list = prev[todayKey] || [];
    return { ...prev, [todayKey]: list.map(m => m.id === mid ? { ...m, ...updates } : m) };
  }), [todayKey]);
  const setCalorieGoal = useCallback(g => setCalorieGoalState(g), []);

  // ─── Water ───────────────────────────────────────────────────────────────────
  const todayWater = waterIntake[todayKey] || 0;
  const addWater = useCallback(oz => setWaterIntake(prev => {
    const cur = prev[todayKey] || 0;
    return { ...prev, [todayKey]: Math.max(0, Math.min(cur + oz, waterGoal * 1.5)) };
  }), [waterGoal]);
  const resetWater = useCallback(() => setWaterIntake(prev => ({ ...prev, [todayKey]: 0 })), []);
  const setWaterGoal = useCallback(g => setWaterGoalState(g), []);
  const setGymWeekPlan = useCallback(fn => {
    setGymWeekPlanState(prev => typeof fn === 'function' ? fn(prev) : fn);
  }, []);

  // ─── Challenges ──────────────────────────────────────────────────────────────
  const startChallenge = useCallback((id) => {
    setChallenges(prev => prev.map(c =>
      c.id === id ? { ...c, status: 'active', startDate: todayKey, checkIns: {} } : c
    ));
  }, [todayKey]);

  const cancelChallenge = useCallback((id) => {
    setChallenges(prev => prev.map(c =>
      c.id === id ? { ...c, status: 'available', startDate: null, checkIns: {}, completedDate: null } : c
    ));
  }, []);

  const createChallenge = useCallback((data) => {
    const newChallenge = {
      id: 'cc' + Date.now(),
      title: data.title,
      description: data.description || '',
      icon: data.icon || '🎯',
      category: data.category || 'lifestyle',
      color: data.color || '#8B5CF6',
      duration: data.duration,
      status: 'available',
      startDate: null,
      completedDate: null,
      checkIns: {},
    };
    setChallenges(prev => [...prev, newChallenge]);
    return newChallenge.id;
  }, []);

  const deleteChallenge = useCallback((id) => {
    setChallenges(prev => prev.filter(c => c.id !== id));
  }, []);

  const toggleChallengeCheckIn = useCallback((id, dateKey) => {
    setChallenges(prev => prev.map(c => {
      if (c.id !== id) return c;
      const checkIns = { ...c.checkIns };
      if (checkIns[dateKey]) delete checkIns[dateKey];
      else checkIns[dateKey] = true;
      const doneCount = Object.keys(checkIns).length;
      const completed = doneCount >= c.duration;
      return { ...c, checkIns, status: completed ? 'completed' : 'active', completedDate: completed ? dateKey : c.completedDate };
    }));
  }, []);

  const completeChallenge = useCallback((id) => {
    setChallenges(prev => prev.map(c =>
      c.id === id ? { ...c, status: 'completed', completedDate: todayKey } : c
    ));
  }, [todayKey]);

  const activeChallenges = challenges.filter(c => c.status === 'active');
  const completedChallenges = challenges.filter(c => c.status === 'completed');
  const availableChallenges = challenges.filter(c => c.status === 'available');

  // ─── Stats ───────────────────────────────────────────────────────────────────
  const getDataForStats = useCallback(() => {
    return { waterIntake, waterGoal, meals, routineCompletions, routines, dailySummaries };
  }, [waterIntake, waterGoal, meals, routineCompletions, routines, dailySummaries]);

  const calcStreak = useCallback((type) => {
    return getStreak(getDataForStats(), type);
  }, [getDataForStats]);

  const getWeeklyData = useCallback((type, days = 7) => {
    return Array.from({ length: days }).map((_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (days - 1 - i));
      const k = toLocalDateKey(d);
      const ds = dailySummaries[k];
      const val = ds?.[type]?.pct ?? completionHistory[k]?.[type] ?? 0;
      return {
        date: k,
        value: val,
        label: d.toLocaleDateString('en', { weekday: 'narrow' }),
        isToday: k === todayKey,
      };
    });
  }, [dailySummaries, completionHistory]);

  const getMonthlyData = useCallback((type) => getWeeklyData(type, 30), [getWeeklyData]);

  const getYearlyData = useCallback(() => {
    return getStats('yearly', getDataForStats());
  }, [getDataForStats]);

  // ─── Reset all user data to defaults ─────────────────────────────────────────
  const resetAllData = useCallback(() => {
    const keys = Object.keys(localStorage).filter(k => k.startsWith(prefix));
    keys.forEach(k => localStorage.removeItem(k));
    setProfileName('');
    setRoutines([]);
    setChallenges(seedChallenges);
    setMeals({});
    setWaterIntake({});
    setCompletionHistory({});
    setWaterHistory({});
    setDailySummariesState({});
    setRoutineCompletions({});
    setWaterGoalState(128);
    setCalorieGoalState(2000);
  }, [prefix]);

  const todayMeals = getTodayMeals();
  const todayMealsDone = todayMeals.filter(m => m.done).length;

  const totalItems = todayRoutines.length + todayMeals.length + 1;
  const doneItems = todayRoutinesDone + todayMealsDone + (todayWater >= waterGoal ? 1 : 0);
  const todayProgress = totalItems ? Math.round((doneItems / totalItems) * 100) : 0;

  return {
    themeMode, effectiveTheme, cycleTheme, setTheme,
    profileName, setProfileName,
    waterUnit, setWaterUnit,
    activeTab, setActiveTab,
    sessionInfo, todayKey, days: DAYS, weekDates, todayDayName,

    routines, addRoutine, updateRoutine, deleteRoutine,
    toggleRoutine, isRoutineDone,
    todayRoutines, todayRoutinesDone,

    meals, getTodayMeals, toggleMeal, addMeal, deleteMeal, updateMeal,
    calorieGoal, setCalorieGoal,

    waterGoal, setWaterGoal,
    waterIntake, todayWater, addWater, resetWater,
    waterHistory,

    dailySummaries, completionHistory,
    calcStreak, getWeeklyData, getMonthlyData, getYearlyData,
    getDataForStats,

    challenges, startChallenge, cancelChallenge, createChallenge, deleteChallenge, toggleChallengeCheckIn, completeChallenge,
    activeChallenges, completedChallenges, availableChallenges,

    todayProgress,
    todayMeals, todayMealsDone,
    resetAllData,
    friendsRefreshKey, refreshFriends,
    gymWeekPlan, setGymWeekPlan,
  };
}