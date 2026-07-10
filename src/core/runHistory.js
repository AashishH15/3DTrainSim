import { getGameMode, isSurvivalMode } from "./config.js";
import { isOfficialRun } from "./integrity.js";
import { displaySimTime, lostRatePerMin } from "../sim/simulation.js";

const HISTORY_KEY = "overland.runHistory_v1";
const MAX_RUNS = 20;

export function loadRunHistory() {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveRunHistory(runs) {
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(runs.slice(0, MAX_RUNS)));
  } catch (e) {
    console.warn("run history save failed", e);
  }
}

function outcomeFromState(state, { victoryGoal = null } = {}) {
  if (victoryGoal) return { outcome: "victory", outcomeLabel: victoryGoal };
  if (state.collapseReason === "network") return { outcome: "network", outcomeLabel: "Network collapsed" };
  if (state.collapseReason === "surge") return { outcome: "surge", outcomeLabel: "Surge collapse" };
  if (state.gameOver) return { outcome: "bankrupt", outcomeLabel: "Bankrupt" };
  return { outcome: "ended", outcomeLabel: "Run ended" };
}

function snapshotFromState(state, opts = {}) {
  const survival = isSurvivalMode(state);
  const mode = getGameMode(state);
  const { outcome, outcomeLabel } = outcomeFromState(state, opts);
  const elapsed = survival && state.gameOver
    ? (state.survivalTime || displaySimTime(state))
    : displaySimTime(state);

  return {
    id: null,
    recordedAt: new Date().toISOString(),
    gameMode: state.gameMode,
    modeName: mode.name,
    mapKey: state.currentMap,
    outcome,
    outcomeLabel: opts.victoryGoal || outcomeLabel,
    headline: opts.victoryGoal || (outcome === "bankrupt" ? "Bankrupt" : outcomeLabel),
    survival,
    survivalTime: survival ? elapsed : 0,
    simTime: displaySimTime(state),
    totalDelivered: state.totalDelivered,
    totalRevenue: state.totalRevenue,
    cash: state.cash,
    trainCount: Object.keys(state.trains || {}).length,
    lostRatePeak: lostRatePerMin(state),
    collapseReason: state.collapseReason,
    officialRun: isOfficialRun(state),
    leaderboardSubmitted: false,
    victoryGoal: opts.victoryGoal || null,
  };
}

/** Append a finished run to history (skips if already recorded for this end id). */
export function recordRunResult(state, opts = {}) {
  const idKey = opts.victoryGoal ? "victoryRecordId" : "endedRunId";
  const history = loadRunHistory();

  if (state[idKey] && history.some((r) => r.id === state[idKey])) {
    return history.find((r) => r.id === state[idKey]);
  }

  const record = snapshotFromState(state, opts);
  if (state[idKey]) {
    record.id = state[idKey];
  } else {
    record.id = `run_${Date.now()}_${Math.round(state.simTime)}_${state.totalDelivered}`;
    state[idKey] = record.id;
  }

  history.unshift(record);
  saveRunHistory(history);
  return record;
}

export function markRunLeaderboardSubmitted(runId) {
  const history = loadRunHistory();
  const idx = history.findIndex((r) => r.id === runId);
  if (idx < 0) return;
  history[idx].leaderboardSubmitted = true;
  saveRunHistory(history);
}

export function canSubmitToLeaderboard(record) {
  return record.survival
    && record.officialRun
    && record.survivalTime > 0
    && (record.outcome === "network" || record.outcome === "surge")
    && !record.leaderboardSubmitted;
}
