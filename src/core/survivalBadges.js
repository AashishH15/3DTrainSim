import { fmtInt } from "./config.js";
import {
  USA_METRO_COUNT,
  stationsOnMap,
  trainCount,
  goalProgressLabel,
  goalProgressRatio,
} from "./goals.js";

const BADGES_KEY = "railEmpireSurvivalBadges_v1";

/** Lifetime Survival badges — unlocked once, stored locally (not per-save). */
export const SURVIVAL_BADGES = [
  // Duration
  {
    id: "survive_10m",
    category: "Duration",
    title: "Still standing",
    desc: "Survive 10 minutes",
    progressUnit: "time",
    progress: (s) => ({ current: s.simTime, target: 600 }),
    done: (s) => s.simTime >= 600,
  },
  {
    id: "survive_30m",
    category: "Duration",
    title: "Holding the line",
    desc: "Survive 30 minutes",
    progressUnit: "time",
    progress: (s) => ({ current: s.simTime, target: 1800 }),
    done: (s) => s.simTime >= 1800,
  },
  {
    id: "survive_1h",
    category: "Duration",
    title: "Marathon operator",
    desc: "Survive 1 hour",
    progressUnit: "time",
    progress: (s) => ({ current: s.simTime, target: 3600 }),
    done: (s) => s.simTime >= 3600,
  },
  // Skill
  {
    id: "lost_free_20m",
    category: "Skill",
    title: "Clean sheet",
    desc: "Zero riders lost for 20 straight minutes",
    done: (s) => (s.survivalRun?.maxLostFreeStreak ?? 0) >= 1200,
  },
  {
    id: "survive_30m_2trains",
    category: "Skill",
    title: "Minimalist",
    desc: "Survive past 30 minutes with only 2 trains",
    done: (s) => s.simTime >= 1800 && (s.survivalRun?.peakTrains ?? 0) <= 2,
  },
  {
    id: "four_trains_no_crowd",
    category: "Skill",
    title: "Smooth operator",
    desc: "Reach 4 trains without a single overcrowding warning",
    done: (s) => trainCount(s) >= 4 && !(s.survivalRun?.hadOvercrowding),
  },
  // Network scale
  {
    id: "survival_usa_50",
    category: "Network",
    title: "National network",
    desc: "Connect all 50 US metros",
    progress: (s) => ({ current: stationsOnMap(s.maps.usa), target: USA_METRO_COUNT }),
    done: (s) => stationsOnMap(s.maps.usa) >= USA_METRO_COUNT,
  },
  {
    id: "survival_passengers_10k",
    category: "Network",
    title: "Mass transit",
    desc: "Deliver 10,000 passengers",
    progress: (s) => ({ current: s.totalDelivered, target: 10_000 }),
    done: (s) => s.totalDelivered >= 10_000,
  },
  {
    id: "survival_passengers_50k",
    category: "Network",
    title: "Nation moved",
    desc: "Deliver 50,000 passengers",
    progress: (s) => ({ current: s.totalDelivered, target: 50_000 }),
    done: (s) => s.totalDelivered >= 50_000,
  },
  {
    id: "survival_passengers_100k",
    category: "Network",
    title: "Main line",
    desc: "Deliver 100,000 passengers",
    progress: (s) => ({ current: s.totalDelivered, target: 100_000 }),
    done: (s) => s.totalDelivered >= 100_000,
  },
  {
    id: "survival_nyc_15",
    category: "Network",
    title: "City network",
    desc: "Build 15 stations on the NYC map",
    progress: (s) => ({ current: stationsOnMap(s.maps.nyc), target: 15 }),
    done: (s) => stationsOnMap(s.maps.nyc) >= 15,
  },
];

const badgeById = Object.fromEntries(SURVIVAL_BADGES.map((b) => [b.id, b]));

export function ensureSurvivalRun(state) {
  if (!state.survivalRun) {
    state.survivalRun = {
      peakTrains: trainCount(state),
      hadOvercrowding: false,
      lastLostAt: 0,
      maxLostFreeStreak: 0,
    };
  }
}

/** Update run-scoped stats used by skill badges (call each economy tick). */
export function tickSurvivalRunStats(state) {
  if (state.gameMode !== "survival") return;
  ensureSurvivalRun(state);
  const run = state.survivalRun;
  run.peakTrains = Math.max(run.peakTrains, trainCount(state));

  const streak = state.simTime - (run.lastLostAt ?? 0);
  run.maxLostFreeStreak = Math.max(run.maxLostFreeStreak, streak);
}

export function noteSurvivalLost(state) {
  if (state.gameMode !== "survival") return;
  ensureSurvivalRun(state);
  state.survivalRun.lastLostAt = state.simTime;
}

export function noteSurvivalOvercrowding(state) {
  if (state.gameMode !== "survival") return;
  ensureSurvivalRun(state);
  state.survivalRun.hadOvercrowding = true;
}

// ---------- lifetime badge persistence ----------

export function loadUnlockedBadges() {
  try {
    const raw = localStorage.getItem(BADGES_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw);
    return new Set(Array.isArray(arr) ? arr : []);
  } catch {
    return new Set();
  }
}

export function saveUnlockedBadges(set) {
  try {
    localStorage.setItem(BADGES_KEY, JSON.stringify([...set]));
  } catch (e) {
    console.warn("badge save failed", e);
  }
}

/** Returns badges newly unlocked this check. */
export function evaluateSurvivalBadges(state) {
  if (state.gameMode !== "survival") return [];
  ensureSurvivalRun(state);
  tickSurvivalRunStats(state);

  const unlocked = loadUnlockedBadges();
  const newly = [];
  for (const b of SURVIVAL_BADGES) {
    if (unlocked.has(b.id)) continue;
    if (b.done(state)) {
      unlocked.add(b.id);
      newly.push(b);
    }
  }
  if (newly.length) saveUnlockedBadges(unlocked);
  return newly;
}

export function getBadge(id) {
  return badgeById[id];
}

export function badgesSummary() {
  const unlocked = loadUnlockedBadges();
  return { done: unlocked.size, total: SURVIVAL_BADGES.length, unlocked };
}

export function nextLockedBadge(state) {
  const unlocked = loadUnlockedBadges();
  return SURVIVAL_BADGES.find((b) => !unlocked.has(b.id)) ?? null;
}

export function badgeProgressLabel(badge, state) {
  return goalProgressLabel(badge, state);
}

export function badgeProgressRatio(badge, state) {
  return goalProgressRatio(badge, state);
}

export function formatBadgeProgress(badge, state) {
  const unlocked = loadUnlockedBadges();
  if (unlocked.has(badge.id)) return badge.desc;
  const label = badgeProgressLabel(badge, state);
  return badge.progress ? `${badge.desc} (${label})` : badge.desc;
}

export function formatSimMinutes(sec) {
  const m = Math.floor(sec / 60);
  if (m >= 60) return `${Math.floor(m / 60)}h ${m % 60}m`;
  return `${m}m`;
}

export function formatBadgeProgressShort(badge, state) {
  const p = badge.progress?.(state);
  if (!p) return badge.title;
  if (badge.progressUnit === "time") {
    return `${badge.title} (${formatSimMinutes(p.current)} / ${formatSimMinutes(p.target)})`;
  }
  if (p.target >= 1000) {
    return `${badge.title} (${fmtInt(Math.min(p.current, p.target))} / ${fmtInt(p.target)})`;
  }
  return `${badge.title} (${Math.min(p.current, p.target)} / ${p.target})`;
}
