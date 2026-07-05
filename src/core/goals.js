import { fmtMoney, fmtInt } from "./config.js";
import { USA_METROS } from "../data/usaMetros.js";
import { NYC_STOPS } from "../data/nycMap.js";

export const USA_METRO_COUNT = USA_METROS.length;
export const NYC_STOP_COUNT = NYC_STOPS.length;

export function stationsOnMap(mapState) {
  return Object.values(mapState.nodes).filter((n) => n.station).length;
}

export function totalTrackSegments(state) {
  return Object.keys(state.maps.usa.edges).length + Object.keys(state.maps.nyc.edges).length;
}

export function trainCount(state) {
  return Object.keys(state.trains).length;
}

export function hasRoutedTrain(state) {
  return Object.values(state.trains).some((t) => t.route.length >= 2 && t.path);
}

export function ownsTier(state, tier) {
  return Object.values(state.trains).some((t) => t.tier === tier);
}

/** Milestones ordered for progression UI. `win` goals trigger the victory screen once. */
export const GOALS = [
  {
    id: "first_station",
    title: "Open for business",
    desc: "Build your first station",
    done: (s) => stationsOnMap(s.maps.usa) + stationsOnMap(s.maps.nyc) >= 1,
  },
  {
    id: "first_track",
    title: "On the map",
    desc: "Connect two stations with track",
    done: (s) => totalTrackSegments(s) >= 1,
  },
  {
    id: "first_route",
    title: "All aboard",
    desc: "Assign a train route",
    done: hasRoutedTrain,
  },
  {
    id: "passengers_1k",
    title: "Getting busy",
    desc: "Deliver 1,000 passengers",
    progress: (s) => ({ current: s.totalDelivered, target: 1000 }),
    done: (s) => s.totalDelivered >= 1000,
  },
  {
    id: "cash_2m",
    title: "In the black",
    desc: "Reach $2M cash",
    progress: (s) => ({ current: Math.max(0, s.cash), target: 2_000_000 }),
    done: (s) => s.cash >= 2_000_000,
  },
  {
    id: "usa_10",
    title: "Regional operator",
    desc: "Build stations at 10 US metros",
    progress: (s) => ({ current: stationsOnMap(s.maps.usa), target: 10 }),
    done: (s) => stationsOnMap(s.maps.usa) >= 10,
  },
  {
    id: "fleet_3",
    title: "Growing fleet",
    desc: "Own 3 trains",
    progress: (s) => ({ current: trainCount(s), target: 3 }),
    done: (s) => trainCount(s) >= 3,
  },
  {
    id: "revenue_1m",
    title: "Fare collector",
    desc: "Earn $1M in total fares",
    progress: (s) => ({ current: s.totalRevenue, target: 1_000_000 }),
    done: (s) => s.totalRevenue >= 1_000_000,
  },
  {
    id: "usa_25",
    title: "Coast to coast",
    desc: "Build stations at 25 US metros",
    progress: (s) => ({ current: stationsOnMap(s.maps.usa), target: 25 }),
    done: (s) => stationsOnMap(s.maps.usa) >= 25,
  },
  {
    id: "nyc_5",
    title: "Five boroughs",
    desc: "Build 5 stations on the NYC map",
    progress: (s) => ({ current: stationsOnMap(s.maps.nyc), target: 5 }),
    done: (s) => stationsOnMap(s.maps.nyc) >= 5,
  },
  {
    id: "tier2",
    title: "High-speed era",
    desc: "Own a Tier II high-speed train",
    done: (s) => ownsTier(s, 2),
  },
  {
    id: "passengers_10k",
    title: "Mass transit",
    desc: "Deliver 10,000 passengers",
    progress: (s) => ({ current: s.totalDelivered, target: 10_000 }),
    done: (s) => s.totalDelivered >= 10_000,
  },
  {
    id: "nyc_15",
    title: "City network",
    desc: "Build 15 stations on the NYC map",
    progress: (s) => ({ current: stationsOnMap(s.maps.nyc), target: 15 }),
    done: (s) => stationsOnMap(s.maps.nyc) >= 15,
  },
  {
    id: "usa_50",
    title: "National network",
    desc: "Connect all 50 US metros with stations",
    win: true,
    progress: (s) => ({ current: stationsOnMap(s.maps.usa), target: USA_METRO_COUNT }),
    done: (s) => stationsOnMap(s.maps.usa) >= USA_METRO_COUNT,
  },
  {
    id: "tier3",
    title: "Maglev future",
    desc: "Own a Tier III maglev train",
    done: (s) => ownsTier(s, 3),
  },
  {
    id: "cash_5m",
    title: "Rail tycoon",
    desc: "Reach $5M cash",
    win: true,
    progress: (s) => ({ current: Math.max(0, s.cash), target: 5_000_000 }),
    done: (s) => s.cash >= 5_000_000,
  },
  {
    id: "passengers_50k",
    title: "Nation moved",
    desc: "Deliver 50,000 passengers",
    progress: (s) => ({ current: s.totalDelivered, target: 50_000 }),
    done: (s) => s.totalDelivered >= 50_000,
  },
];

const goalById = Object.fromEntries(GOALS.map((g) => [g.id, g]));

export function ensureGoalState(state) {
  if (!state.completedGoals) state.completedGoals = [];
  if (state.victoryShown == null) state.victoryShown = false;
}

/** Backfill completed goals on load without notifications. */
export function syncGoalProgress(state) {
  ensureGoalState(state);
  const done = new Set(state.completedGoals);
  for (const g of GOALS) {
    if (!done.has(g.id) && g.done(state)) state.completedGoals.push(g.id);
  }
}

/** Returns goals newly completed this check. */
export function evaluateNewGoals(state) {
  ensureGoalState(state);
  const done = new Set(state.completedGoals);
  const newly = [];
  for (const g of GOALS) {
    if (done.has(g.id)) continue;
    if (g.done(state)) {
      state.completedGoals.push(g.id);
      newly.push(g);
    }
  }
  return newly;
}

export function getGoal(id) {
  return goalById[id];
}

export function nextIncompleteGoal(state) {
  ensureGoalState(state);
  const done = new Set(state.completedGoals);
  return GOALS.find((g) => !done.has(g.id)) ?? null;
}

export function goalProgressLabel(goal, state) {
  const p = goal.progress?.(state);
  if (!p) return goal.desc;
  const cur = Math.min(p.current, p.target);
  if (p.target >= 1_000_000) {
    return `${fmtMoney(cur)} / ${fmtMoney(p.target)}`;
  }
  if (Number.isInteger(p.target) && p.target >= 1000) {
    return `${fmtInt(cur)} / ${fmtInt(p.target)}`;
  }
  return `${cur} / ${p.target}`;
}

export function goalProgressRatio(goal, state) {
  const p = goal.progress?.(state);
  if (!p || p.target <= 0) return null;
  return Math.min(1, p.current / p.target);
}

export function goalsSummary(state) {
  ensureGoalState(state);
  const done = state.completedGoals.length;
  return { done, total: GOALS.length };
}
