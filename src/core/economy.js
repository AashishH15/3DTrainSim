import { TRACK_TYPES, ECON, WATER_COST_MULT, unlockCost, TIERS, getGameMode } from "./config.js";

export function trackCost(mapKey, type, length, waterFrac = 0, state = null) {
  const base = TRACK_TYPES[type].costPerUnit[mapKey] * length;
  const mult = 1 + waterFrac * (WATER_COST_MULT - 1);
  const costMult = state ? costMultiplier(state) : 1;
  return Math.round(base * mult * costMult);
}

export function edgeBuildCost(mapKey, edge, state = null) {
  return trackCost(mapKey, edge.type, edge.length, edge.waterFrac, state);
}

export function upgradeCost(mapKey, edge, newType, state = null) {
  const oldCost = edgeBuildCost(mapKey, edge, state);
  const newCost = trackCost(mapKey, newType, edge.length, edge.waterFrac, state);
  return Math.max(0, Math.round((newCost - oldCost) * (1 + ECON.upgradeSurcharge)));
}

export function stationCost(mapKey, node, state = null) {
  const base = ECON.stationCostBase[mapKey] * (1 + node.demand * ECON.stationDemandFactor);
  const costMult = state ? costMultiplier(state) : 1;
  return Math.round(base * costMult);
}

export function nodeUnlockCost(node, state = null) {
  const base = unlockCost(node.pop ?? 1);
  const costMult = state ? costMultiplier(state) : 1;
  return Math.round(base * costMult);
}

export function bulldozeRefund(mapKey, edge, state = null) {
  return Math.round(edgeBuildCost(mapKey, edge, state) * 0.25);
}

export function trainPurchaseCost(tier, state = null) {
  const base = TIERS[tier].price;
  const costMult = state ? costMultiplier(state) : 1;
  return Math.round(base * costMult);
}

export function trainSellRefund(tier, state = null) {
  return Math.round(trainPurchaseCost(tier, state) * 0.5);
}

/** Time-only demand multiplier from elapsed sim-days. */
export function timeGrowthFactor(growth, days) {
  if (growth.shape === "compound") {
    return Math.pow(1 + growth.perDayBase, days);
  }
  return 1 + growth.perDayBase * days;
}

export function costMultiplier(state) {
  if (!state) return 1;
  const g = getGameMode(state).growth;
  if (!g.costGrowthPerDay) return 1;
  const gracePeriodDays = 2.5; // 10 sim-minutes grace
  const days = state.simTime / 240;
  const effectiveDays = Math.max(0, days - gracePeriodDays);
  const trainCount = Object.keys(state.trains || {}).length;
  // Hybrid Formula: 1 + (trains * 0.1) + (1.2 * sqrt(effectiveDays))
  return 1 + (trainCount * 0.1) + (1.2 * Math.sqrt(effectiveDays));
}

export function calculateBondTaxRate(principal) {
  const x = principal / 1000000; // in Millions
  if (x <= 0.5) return 0.10;
  if (x <= 1.0) {
    const pct = (x - 0.5) / 0.5;
    return 0.10 + pct * 0.08;
  }
  if (x <= 2.0) {
    const pct = (x - 1.0) / 1.0;
    return 0.18 + pct * 0.12;
  }
  if (x <= 3.0) {
    const pct = (x - 2.0) / 1.0;
    return 0.30 + pct * 0.10;
  }
  const pct = Math.min(1.0, (x - 3.0) / 2.0);
  return 0.40 + pct * 0.10;
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
  const vipMult = node.vipSurgeActive ? 4.0 : 1.0;
  return node.demand * demandGrowthMultiplier(node, state) * vipMult;
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
