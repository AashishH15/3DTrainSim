import { isSurvivalMode } from "../core/config.js";
import { serviceReachableStations } from "./serviceGraph.js";
import { noteSurvivalLost } from "../core/survivalBadges.js";
import { emit } from "../core/bus.js";
import { fmtMoney } from "../core/config.js";

function getRandomSurgeIntervalSec() {
  // Random surge interval between 2 minutes (120s) and 10 minutes (600s)
  return 120 + Math.random() * 480;
}

const MAX_CONCURRENT_SURGES = 2;     // Cap total active/frustrated surges to 2 max
const SURGE_DURATION_SEC = 120;      // 120 seconds to connect and claim reward
const FRUSTRATED_DECAY_SEC = 240;    // 4 minutes (240s) of frustration penalty before surge decays out
const SURGE_REWARD = 250000;         // $250k grant for fulfilling active surge
const FRUSTRATION_LOST_PER_MIN = 12; // 12 lost passengers per minute per unserved surge city

export function updateSurges(state, dt) {
  if (!isSurvivalMode(state) || state.gameOver) return;

  if (!state.surgeState) {
    state.surgeState = {
      nextSurgeTime: 120 + Math.random() * 120, // First surge arrives between 2 to 4 sim-minutes
      surges: {},
      abandonedNodes: {},
      abandonedCount: 0,
    };
  }

  const ss = state.surgeState;
  if (!ss.abandonedNodes) ss.abandonedNodes = {};
  const currentMap = state.currentMap || "usa";
  const ms = state.maps[currentMap];
  if (!ms) return;

  // 1. Check if it's time to spawn a new surge (guarded by MAX_CONCURRENT_SURGES)
  if (state.simTime >= ss.nextSurgeTime) {
    ss.nextSurgeTime = state.simTime + getRandomSurgeIntervalSec();

    const activeSurgeCount = Object.keys(ss.surges).length;
    if (activeSurgeCount < MAX_CONCURRENT_SURGES) {
      // Pick a random unbuilt node that doesn't currently have an active surge or pending strike
      const candidateNodes = Object.values(ms.nodes).filter(
        (n) => !n.station && !ss.surges[n.id] && !ss.abandonedNodes[n.id]
      );

      if (candidateNodes.length > 0) {
        const picked = candidateNodes[Math.floor(Math.random() * candidateNodes.length)];
        ss.surges[picked.id] = {
          mapKey: currentMap,
          timer: SURGE_DURATION_SEC,
          frustrated: false,
          frustrationTimer: FRUSTRATED_DECAY_SEC,
          name: picked.name,
        };
        picked.surgeActive = true;
        picked.surgeTimer = SURGE_DURATION_SEC;
        picked.surgeFrustrated = false;

        const surgeNodeId = picked.id;
        const surgeMapKey = currentMap;
        emit("toast", {
          msg: `🔥 DEMAND SURGE: ${picked.name} demands transit connection within 120s!`,
          kind: "bad",
          key: `surge:${picked.id}`,
          action: {
            label: "View City",
            onClick: () => window.game?.panToNode(surgeNodeId, surgeMapKey),
          },
        });
      }
    }
  }

  // Check for reconnection of previously abandoned nodes to trigger redemption mode
  for (const [nodeId, item] of Object.entries(ss.abandonedNodes)) {
    const nodeMap = state.maps[item.mapKey || currentMap];
    const node = nodeMap?.nodes[nodeId];
    if (!node) continue;

    const isConnected =
      node.station && serviceReachableStations(state, item.mapKey || currentMap, nodeId).length > 0;

    if (isConnected && !item.connected) {
      item.connected = true;
      node.surgeAbandoned = false;
      node.surgeRedeeming = true;
      emit("toast", {
        msg: `✅ ${node.name} connected! Delivering passengers will restore trust (500 pax per -1 Lost/min penalty).`,
        kind: "good",
        key: `surge-reconnect:${nodeId}`,
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
        surge.frustrationTimer = FRUSTRATED_DECAY_SEC;
        node.surgeActive = false;
        node.surgeFrustrated = true;

        const expiredNodeId = nodeId;
        const expiredMapKey = surge.mapKey;
        emit("toast", {
          msg: `⚠️ SURGE EXPIRED! Citizens in ${node.name} are frustrated (+${FRUSTRATION_LOST_PER_MIN} Lost/min)!`,
          kind: "bad",
          key: `surge-expired:${nodeId}`,
          action: {
            label: "View City",
            onClick: () => window.game?.panToNode(expiredNodeId, expiredMapKey),
          },
        });
      }
    } else {
      // Frustrated state: generates lost riders directly into lostWindow each tick
      surge.frustrationTimer -= dt;
      node.frustrationTimer = Math.max(0, Math.ceil(surge.frustrationTimer));
      const lostThisTick = FRUSTRATION_LOST_PER_MIN * (dt / 60);
      state.totalLost += lostThisTick;
      noteSurvivalLost(state);
      state.lostWindow.push([state.simTime, lostThisTick]);

      // If frustration decay timer expires (4 minutes): citizens give up and surge is abandoned
      if (surge.frustrationTimer <= 0) {
        ss.abandonedNodes[nodeId] = {
          penalty: 5,
          delivered: 0,
          connected: false,
          name: node.name,
          mapKey: surge.mapKey,
        };
        ss.abandonedCount = Object.keys(ss.abandonedNodes).length;

        emit("toast", {
          msg: `❌ Citizens in ${node.name} gave up! Strike added (+5 Lost/min penalty).`,
          kind: "bad",
          key: `surge-abandoned:${nodeId}`,
        });
        node.surgeActive = false;
        node.surgeFrustrated = false;
        node.surgeAbandoned = true;
        delete ss.surges[nodeId];
      }
    }
  }
}
