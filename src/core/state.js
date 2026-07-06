import { ECON, USA_FREE_RANKS } from "./config.js";
import { USA_METROS } from "../data/usaMetros.js";
import { NYC_STOPS, waterFraction } from "../data/nycMap.js";
import { projectMetro } from "../render/usaProjection.js";
import { nodeDist, edgeKey, bumpPathVersion } from "./graph.js";
import { applySaveSeal, verifySaveSeal } from "./integrity.js";

const SAVE_KEY = "railEmpireSave_v1";

export function metroDemand(pop) {
  return +(2 + pop * 0.45).toFixed(1);
}

export function freshState(gameMode = "tycoon") {
  const usaNodes = {};
  for (const m of USA_METROS) {
    const [x, z] = projectMetro(m);
    usaNodes[`usa_${m.rank}`] = {
      id: `usa_${m.rank}`,
      name: m.name,
      rank: m.rank,
      pop: m.pop,
      x, z,
      demand: metroDemand(m.pop),
      unlocked: m.rank <= USA_FREE_RANKS,
      station: false,
      waiting: [],
      spawnAcc: 0,
      servedTotal: 0,
    };
  }

  const nycNodes = {};
  for (const s of NYC_STOPS) {
    nycNodes[s.id] = {
      id: s.id,
      name: s.name,
      x: s.x, z: s.z,
      demand: s.demand,
      landmark: s.landmark,
      unlocked: true,
      station: false,
      waiting: [],
      spawnAcc: 0,
      servedTotal: 0,
    };
  }

  return {
    version: 1,
    gameMode,
    cash: ECON.startCash,
    totalDelivered: 0,
    totalRevenue: 0,
    totalLost: 0,
    simTime: 0,
    clockStarted: false, // simTime / HUD timer begin on first passenger spawn
    speed: 1,
    debtTimer: 0,
    gameOver: false,
    victoryShown: false,
    completedGoals: [],
    currentMap: "usa",
    maps: {
      usa: { nodes: usaNodes, edges: {}, pathVersion: 0, fareMult: 1.0 },
      nyc: { nodes: nycNodes, edges: {}, pathVersion: 0, fareMult: 1.0 },
    },
    trains: {},
    nextTrainId: 1,
    activeBond: null,
    incomeWindow: [], // [simTime, delta] samples for $/min display
    lostWindow: [], // [simTime, count] samples for lost/min when network pressure is on
    breachTimer: 0, // sustained lost-rate breach accumulator (sim-seconds)
    pressureStrikeCount: 0, // permanent strikes from sustained high Lost/min
    collapseReason: null, // null | "network"
    survivalTime: 0, // sim-seconds survived at collapse (score)
    cityMapsUnlocked: false,
    officialRun: true,
    survivalRun: gameMode === "survival" ? {
      peakTrains: 0,
      hadOvercrowding: false,
      lastLostAt: 0,
      maxLostFreeStreak: 0,
    } : null,
  };
}

export function makeEdge(state, mapKey, aId, bId, type) {
  const ms = state.maps[mapKey];
  const na = ms.nodes[aId];
  const nb = ms.nodes[bId];
  const length = nodeDist(na, nb);
  const waterFrac = mapKey === "nyc" ? waterFraction(na.x, na.z, nb.x, nb.z) : 0;
  const edge = { id: edgeKey(aId, bId), a: aId, b: bId, type, length, waterFrac };
  ms.edges[edge.id] = edge;
  bumpPathVersion(ms);
  return edge;
}

export function removeEdge(state, mapKey, edgeId) {
  delete state.maps[mapKey].edges[edgeId];
  bumpPathVersion(state.maps[mapKey]);
}

// ---------- persistence ----------

export function saveState(state) {
  try {
    applySaveSeal(state);
    localStorage.setItem(SAVE_KEY, JSON.stringify(state));
  } catch (e) {
    console.warn("save failed", e);
  }
}

export function loadState() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw);
    if (s?.version !== 1) return null;
    if (!s.gameMode) s.gameMode = "tycoon";
    if (!s.completedGoals) s.completedGoals = [];
    if (s.victoryShown == null) s.victoryShown = false;
    if (s.totalLost == null) s.totalLost = 0;
    if (!s.lostWindow) s.lostWindow = [];
    if (s.breachTimer == null) s.breachTimer = 0;
    if (s.pressureStrikeCount == null) s.pressureStrikeCount = 0;
    if (s.collapseReason == null) s.collapseReason = null;
    if (s.survivalTime == null) s.survivalTime = 0;
    if (s.cityMapsUnlocked == null) s.cityMapsUnlocked = false;
    if (s.officialRun == null) s.officialRun = true;
    if (s.clockStarted == null) {
      const waiting = ["usa", "nyc"].reduce(
        (n, mk) => n + Object.values(s.maps[mk].nodes).reduce((w, node) => w + node.waiting.reduce((a, g) => a + g.count, 0), 0),
        0
      );
      s.clockStarted = s.totalDelivered > 0 || waiting > 0;
    }
    if (s.gameMode === "survival" && !s.survivalRun) {
      s.survivalRun = {
        peakTrains: Object.keys(s.trains ?? {}).length,
        hadOvercrowding: false,
        lastLostAt: 0,
        maxLostFreeStreak: 0,
      };
    }
    if (s.activeBond === undefined) {
      s.activeBond = null;
    }
    for (const mk of ["usa", "nyc"]) {
      if (s.maps[mk].fareMult == null) s.maps[mk].fareMult = 1.0;
    }
    // Refresh static node positions/demand in case data was retuned.
    const fresh = freshState();
    for (const mk of ["usa", "nyc"]) {
      for (const id in fresh.maps[mk].nodes) {
        const fn = fresh.maps[mk].nodes[id];
        const sn = s.maps[mk].nodes[id];
        if (sn) Object.assign(sn, { x: fn.x, z: fn.z, demand: fn.demand, name: fn.name });
        else s.maps[mk].nodes[id] = fn;
      }
    }
    verifySaveSeal(s);
    return s;
  } catch {
    return null;
  }
}

export function clearSave() {
  localStorage.removeItem(SAVE_KEY);
}
