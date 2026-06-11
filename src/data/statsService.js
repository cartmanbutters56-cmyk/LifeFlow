import { getDateRange, getDatesInRange, getTodayKey } from './sessionService';

function safePct(value, total) {
  if (!total || total === 0) return 0;
  return Math.min(Math.round((value / total) * 100), 100);
}

function avg(arr) {
  if (!arr.length) return 0;
  return Math.round(arr.reduce((s, v) => s + v, 0) / arr.length);
}

function sum(arr) {
  return arr.reduce((s, v) => s + v, 0);
}

function getEntry(data, dateKey, fallback) {
  return data && data[dateKey] !== undefined ? data[dateKey] : fallback;
}

export function buildDailySummary(dateKey, data) {
  const {
    waterIntake = {}, waterGoal = 128,
    meals = {}, routineCompletions = {},
    routines = [],
  } = data;

  const water = getEntry(waterIntake, dateKey, 0);
  const waterPct = safePct(water, waterGoal);

  const todayMeals = getEntry(meals, dateKey, []);
  const mealsDone = todayMeals.filter(m => m.done).length;
  const mealsTotal = todayMeals.length;
  const mealCalories = todayMeals.reduce((s, m) => s + (m.calories || 0), 0);
  const mealPct = safePct(mealsDone, mealsTotal);

  const dateObj = new Date(dateKey + 'T12:00:00');
  const dayName = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][dateObj.getDay()];
  const todayRoutines = routines.filter(r => r.days && r.days.includes(dayName));
  const routinesDone = todayRoutines.filter(r => !!routineCompletions[`${r.id}_${dateKey}`]).length;
  const routinesTotal = todayRoutines.length;
  const routinePct = safePct(routinesDone, routinesTotal);

  const allPcts = [waterPct, mealPct, routinePct].filter(p => p > 0);
  const overallPct = allPcts.length ? Math.round(avg(allPcts)) : 0;

  return {
    date: dateKey,
    water: { value: water, goal: waterGoal, pct: waterPct },
    meals: { done: mealsDone, total: mealsTotal, calories: mealCalories, pct: mealPct },
    routines: { done: routinesDone, total: routinesTotal, pct: routinePct },
    overall: { pct: overallPct },
  };
}

export function buildDailySummaries(data) {
  const { dailySummaries = {} } = data;
  const todayKey = getTodayKey();
  const summary = buildDailySummary(todayKey, data);
  dailySummaries[todayKey] = summary;
  return dailySummaries;
}

export function getStats(type, data) {
  const todayKey = getTodayKey();
  const range = getDateRange(type);
  const dateKeys = getDatesInRange(range.start, range.end);

  const summaries = dateKeys.map(dk => {
    const cached = data.dailySummaries && data.dailySummaries[dk];
    if (cached) return cached;
    return buildDailySummary(dk, data);
  });

  const categories = ['water', 'meals', 'routines'];

  const categoryStats = {};
  for (const cat of categories) {
    const values = summaries.map(s => s[cat]?.pct ?? 0);
    const doneValues = summaries.map(s => {
      const c = s[cat];
      if (!c) return 0;
      if (cat === 'water') return c.value;
      if (cat === 'meals') return c.done;
      if (cat === 'routines') return c.done;
      return 0;
    });
    const totalValues = summaries.map(s => {
      const c = s[cat];
      if (!c) return 0;
      if (cat === 'water') return c.goal;
      if (cat === 'meals') return c.total;
      if (cat === 'routines') return c.total;
      return 0;
    });

    categoryStats[cat] = {
      avg: avg(values),
      total: sum(doneValues),
      max: Math.max(...values, 0),
      min: Math.min(...values.filter(v => v > 0), 0),
      trend: values,
      labels: summaries.map(s => {
        const d = new Date(s.date + 'T12:00:00');
        return d.toLocaleDateString('en', { weekday: type === 'yearly' ? 'short' : 'narrow' });
      }),
      dates: summaries.map(s => s.date),
      raw: summaries.map(s => s[cat]),
    };
  }

  const overallPcts = summaries.map(s => s.overall?.pct ?? 0);
  const overallAvg = avg(overallPcts);

  const half = Math.floor(summaries.length / 2);
  const firstHalf = avg(overallPcts.slice(0, half));
  const secondHalf = avg(overallPcts.slice(half));
  const diff = secondHalf - firstHalf;

  return {
    period: type,
    range,
    dateKeys,
    summaries,
    categories: categoryStats,
    overall: {
      avg: overallAvg,
      trend: diff,
      isUp: diff >= 0,
      trendText: `${diff >= 0 ? '+' : ''}${diff}%`,
    },
  };
}

export function getStreak(data, type, maxDays = 365) {
  const { dailySummaries = {}, completionHistory = {} } = data;
  const allKeys = new Set([...Object.keys(dailySummaries), ...Object.keys(completionHistory)]);
  const keys = [...allKeys].sort().reverse();
  let streak = 0;
  for (const key of keys) {
    const fromDS = dailySummaries[key]?.[type]?.pct;
    const fromCH = completionHistory[key]?.[type];
    const val = fromDS !== undefined ? fromDS : fromCH;
    if (val !== undefined && val > 0) streak++;
    else if (streak > 0) break;
    if (streak >= maxDays) break;
  }
  return streak;
}

export function getLongestStreak(data, type) {
  const { dailySummaries = {}, completionHistory = {} } = data;
  const allKeys = new Set([...Object.keys(dailySummaries), ...Object.keys(completionHistory)]);
  const keys = [...allKeys].sort();
  let maxStreak = 0;
  let current = 0;
  for (const key of keys) {
    const fromDS = dailySummaries[key]?.[type]?.pct;
    const fromCH = completionHistory[key]?.[type];
    const val = fromDS !== undefined ? fromDS : fromCH;
    if (val !== undefined && val > 0) {
      current++;
      maxStreak = Math.max(maxStreak, current);
    } else {
      current = 0;
    }
  }
  return maxStreak;
}
