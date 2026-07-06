import { isSurvivalMode } from "../core/config.js";
import { serviceReachableStations } from "./serviceGraph.js";
import { noteSurvivalLost } from "../core/survivalBadges.js";
import { emit } from "../core/bus.js";
import { fmtMoney } from "../core/config.js";

const SURGE_INTERVAL_SEC = 210; // New surge every ~3.5 sim-minutes
const SURGE_DURATION_SEC = 120; // 120 seconds to connect
const SURGE_REWARD = 250000;    // $250k grant for fulfilling surge
const FRUSTRATION_LOST_PER_MIN = 12; // 12 lost passengers per minute per unserved surge city

export function updateSurges(state, dt) {
  if (!isSurvivalMode(state) || state.gameOver) return;

  if (!state.surgeState) {
    state.surgeState = {
      nextSurgeTime: 120, // First surge arrives at 2 sim-minutes
      surges: {},
    };
  }

  const ss = state.surgeState;
  const currentMap = state.currentMap || "usa";
  const ms = state.maps[currentMap];
  if (!ms) return;

  // 1. Check if it's time to spawn a new surge
  if (state.simTime >= ss.nextSurgeTime) {
    ss.nextSurgeTime = state.simTime + SURGE_INTERVAL_SEC;

    // Pick a random unbuilt node that doesn't currently have an active surge
    const candidateNodes = Object.values(ms.nodes).filter(
      (n) => !n.station && !ss.surges[n.id]
    );

    if (candidateNodes.length > 0) {
      const picked = candidateNodes[Math.floor(Math.random() * candidateNodes.length)];
      ss.surges[picked.id] = {
        mapKey: currentMap,
        timer: SURGE_DURATION_SEC,
        frustrated: false,
        name: picked.name,
      };
      picked.surgeActive = true;
      picked.surgeTimer = SURGE_DURATION_SEC;
      picked.surgeFrustrated = false;

      emit("toast", {
        msg: `🔥 DEMAND SURGE: ${picked.name} demands transit connection within 120s!`,
        kind: "bad",
        key: `surge:${picked.id}`,
      });
    }
  }

  // 2. Process active and frustrated surges
  for (const [nodeId, surge] of Object.entries(ss.surges)) {
    const nodeMap = state.maps[surge.mapKey];
    const node = nodeMap?.nodes[nodeId];

    if (!node) {
      delete ss.surges[nodeId];
      continue;
    }

    // Check if player has built a station and connected it to the transit network
    const isConnected =
      node.station && serviceReachableStations(state, surge.mapKey, nodeId).length > 0;

    if (isConnected) {
      if (!surge.frustrated) {
        state.cash += SURGE_REWARD;
        emit("toast", {
          msg: `✅ SURGE FULFILLED! ${node.name} connected — +${fmtMoney(SURGE_REWARD)} grant!`,
          kind: "good",
          key: `surge-fulfilled:${nodeId}`,
        });
      } else {
        emit("toast", {
          msg: `✅ Transit connected to ${node.name}! Frustration cleared.`,
          kind: "good",
          key: `surge-cleared:${nodeId}`,
        });
      }
      node.surgeActive = false;
      node.surgeFrustrated = false;
      delete ss.surges[nodeId];
      continue;
    }

    // If still unconnected:
    if (!surge.frustrated) {
      surge.timer -= dt;
      node.surgeTimer = Math.max(0, Math.ceil(surge.timer));

      if (surge.timer <= 0) {
        surge.frustrated = true;
        node.surgeActive = false;
        node.surgeFrustrated = true;

        emit("toast", {
          msg: `⚠️ SURGE EXPIRED! Citizens in ${node.name} are frustrated (+${FRUSTRATION_LOST_PER_MIN} Lost/min)!`,
          kind: "bad",
          key: `surge-expired:${nodeId}`,
        });
      }
    } else {
      // Frustrated penalty: generates lost riders directly into lostWindow each tick
      const lostThisTick = FRUSTRATION_LOST_PER_MIN * (dt / 60);
      state.totalLost += lostThisTick;
      noteSurvivalLost(state);
      state.lostWindow.push([state.simTime, lostThisTick]);
    }
  }
}
