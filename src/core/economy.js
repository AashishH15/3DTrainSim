import { TRACK_TYPES, ECON, WATER_COST_MULT, unlockCost, TIERS, getGameMode } from "./config.js";

export function trackCost(mapKey, type, length, waterFrac = 0) {
  const base = TRACK_TYPES[type].costPerUnit[mapKey] * length;
  const mult = 1 + waterFrac * (WATER_COST_MULT - 1);
  return Math.round(base * mult);
}

export function edgeBuildCost(mapKey, edge) {
  return trackCost(mapKey, edge.type, edge.length, edge.waterFrac);
}

export function upgradeCost(mapKey, edge, newType) {
  const oldCost = edgeBuildCost(mapKey, edge);
  const newCost = trackCost(mapKey, newType, edge.length, edge.waterFrac);
  return Math.max(0, Math.round((newCost - oldCost) * (1 + ECON.upgradeSurcharge)));
}

export function stationCost(mapKey, node) {
  return Math.round(ECON.stationCostBase[mapKey] * (1 + node.demand * ECON.stationDemandFactor));
}

export function nodeUnlockCost(node) {
  return unlockCost(node.pop ?? 1);
}

export function bulldozeRefund(mapKey, edge) {
  return Math.round(edgeBuildCost(mapKey, edge) * 0.25);
}

/** Time-only demand multiplier from elapsed sim-days. */
export function timeGrowthFactor(growth, days) {
  if (growth.shape === "compound") {
    return Math.pow(1 + growth.perDayBase, days);
  }
  return 1 + growth.perDayBase * days;
}

/** Inflation multiplier on track maintenance and train operating costs (Survival mode). */
export function costMultiplier(state) {
  const g = getGameMode(state).growth;
  if (!g.costGrowthPerDay) return 1;
  const days = state.simTime / 240;
  return Math.min(6, Math.pow(1 + g.costGrowthPerDay, days));
}

/** Demand multiplier from elapsed time and passengers delivered at this stop. */
export function demandGrowthMultiplier(node, state) {
  const g = getGameMode(state).growth;
  const days = state.simTime / 240;
  const timeMult = timeGrowthFactor(g, days);
  const serviceMult = 1 + g.perThousandServed * (node.servedTotal / 1000);
  return Math.min(g.maxMultiplier, timeMult * serviceMult);
}

// A station's real-time demand: base demand grown by elapsed time and by
// how much ridership it has actually delivered.
export function effectiveDemand(node, state) {
  return node.demand * demandGrowthMultiplier(node, state);
}

/** Player-facing demand line for the inspector. */
export function formatDemandStat(node, state) {
  const g = getGameMode(state).growth;
  const base = node.demand;
  const eff = effectiveDemand(node, state);
  const days = state.simTime / 240;
  const timePct = Math.round((timeGrowthFactor(g, days) - 1) * 100);
  const servicePct = Math.round(g.perThousandServed * (node.servedTotal / 1000) * 100);
  const parts = [`base ${base}`];
  if (timePct > 0) parts.push(`+${timePct}% time`);
  if (servicePct > 0) parts.push(`+${servicePct}% ridership`);
  if (parts.length === 1) return `${eff.toFixed(1)} pts`;
  return `${eff.toFixed(1)} pts (${parts.join(", ")})`;
}

export function platformCapacity(mapKey, node, state) {
  const mc = getGameMode(state).crowding;
  const demandTerm = node.demand * mc.platformPerDemand;
  const popFactor = mc.usePopScale && node.pop
    ? Math.pow(node.pop, mc.platformPop2Exp) * mc.platformPopMult
    : 0;
  const raw = mc.platformBase[mapKey] + demandTerm + popFactor;
  const floor = TIERS[1].capacity * mc.minTrainMultiple;
  return Math.round(Math.max(raw, floor));
}

export function formatCrowdingStat(mapKey, node, state) {
  const waiting = node.waiting.reduce((s, g) => s + g.count, 0);
  const cap = platformCapacity(mapKey, node, state);
  const pct = cap > 0 ? Math.round((waiting / cap) * 100) : 0;
  if (node.crowded) return `${waiting} / ${cap} · overcrowded, riders leaving`;
  if (pct >= 70) return `${waiting} / ${cap} · filling up`;
  return `${waiting} / ${cap}`;
}
