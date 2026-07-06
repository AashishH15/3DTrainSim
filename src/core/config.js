// Central tuning knobs for economy, trains and track.

export const TRACK_TYPES = {
  1: {
    id: 1,
    name: "Standard Track",
    color: 0x8d99ae,
    // cost per world-unit of length, per map
    costPerUnit: { usa: 2500, nyc: 9000 },
    maintPerUnitPerMin: 1.2,
    allows: (tier) => tier === 1,
  },
  2: {
    id: 2,
    name: "High-Speed Track",
    color: 0xffb547,
    costPerUnit: { usa: 6500, nyc: 22000 },
    maintPerUnitPerMin: 2.6,
    allows: (tier) => tier === 1 || tier === 2,
  },
  3: {
    id: 3,
    name: "Maglev Guideway",
    color: 0x55b6ff,
    costPerUnit: { usa: 15000, nyc: 48000 },
    maintPerUnitPerMin: 5.0,
    allows: (tier) => tier === 3,
  },
};

// Extra multiplier applied to the fraction of an edge that crosses water (NYC only).
export const WATER_COST_MULT = 2.6;

export const TIERS = {
  1: {
    id: 1,
    name: "Tier I Standard Rail",
    short: "Standard",
    desc: "Classic boxy regional train. Cheap, flexible, runs on standard or high-speed track.",
    speed: { usa: 7, nyc: 9 },       // world units / sim-second
    capacity: 200,
    price: 120000,
    opsPerMin: 450,                   // $/sim-minute while owned
    fareMult: 1.0,
    color: 0x4cd97b,
    minTrack: "Standard or High-Speed",
  },
  2: {
    id: 2,
    name: "Tier II High-Speed Rail",
    short: "High-Speed",
    desc: "Sleek aerodynamic trainset up to 220 mph. Requires dedicated High-Speed Track.",
    speed: { usa: 14, nyc: 15 },
    capacity: 320,
    price: 420000,
    opsPerMin: 1150,
    fareMult: 1.5,
    color: 0xffb547,
    minTrack: "High-Speed only",
  },
  3: {
    id: 3,
    name: "Tier III Maglev",
    short: "Maglev",
    desc: "Futuristic maglev pod up to 400 mph. Requires premium Maglev Guideway.",
    speed: { usa: 24, nyc: 24 },
    capacity: 420,
    price: 1150000,
    opsPerMin: 2600,
    fareMult: 2.2,
    color: 0x55b6ff,
    minTrack: "Maglev Guideway only",
  },
};

export const ECON = {
  startCash: 1600000,
  farePerUnit: { usa: 40, nyc: 10 },    // $ per passenger per world-unit travelled
  stationCostBase: { usa: 60000, nyc: 45000 },
  // station cost scales with demand: cost = base * (1 + demand * stationDemandFactor)
  stationDemandFactor: 0.5,
  upgradeSurcharge: 0.25,              // upgrading track costs (newCost - oldCost) * (1 + this)
  debtLimit: -250000,                  // bankruptcy below this
  debtGraceSec: 45,                    // sim-seconds allowed below the limit before game over
  cityMapPurchasePrice: 2_000_000,     // one-time purchase for the NYC detail map
  dwellTime: 2.2,                      // seconds a train waits at each stop
};

// Nodes with rank <= this are in your starter network on the USA map; expanding
// into other metros costs a fee that scales with metro size.
export const USA_FREE_RANKS = 12;
export const unlockCost = (pop) => Math.round((30000 + pop * 22000) / 1000) * 1000;

export const SIM = {
  tickSeconds: 0.5,          // passenger/economy tick length in sim-seconds
  demandScale: { usa: 0.15, nyc: 0.30 }, // passengers per demand-point per sim-second
};

// City/ridership growth defaults (Tycoon uses linear shape via GAME_MODES).
export const GROWTH = {
  perDayBase: 0.012,
  perThousandServed: 0.05,
  maxMultiplier: 3.5,
};

export const CROWDING = {
  patienceSec: 90,
  dropoutRatePerSec: 0.02,
};

export const PRESSURE_DEFAULTS = {
  lostWindowSec: 60, // trailing window — matches incomePerMin; lagging vs patienceSec (90)
  rateThresholdPerMin: 25, // threshold for 5 strikes (+5 Lost/min each)
  collapseGraceSec: 240, // sustained breach (4 sim-min); keep > window + patience
  breachDecayFactor: 0.5, // gradual recovery below threshold
};

/** Per-mode rules: platform sizing, growth curve, fail conditions, HUD. */
export const GAME_MODES = {
  tycoon: {
    id: "tycoon",
    name: "Tycoon",
    tagline: "Creative rail sandbox",
    blurb: "Low-risk building mode with relaxed pressure, milestone goals, and room to make the network you want.",
    goals: true,
    bankruptcy: true,
    networkPressure: false,
    demandScaleMult: 1,
    growth: {
      shape: "linear",
      perDayBase: 0.012,
      perThousandServed: 0.05,
      maxMultiplier: 3.5,
    },
    crowding: {
      platformBase: { usa: 40, nyc: 25 },
      platformPerDemand: 3,
      usePopScale: false,
      minTrainMultiple: 1.5,
    },
    pressure: PRESSURE_DEFAULTS,
  },
  survival: {
    id: "survival",
    name: "Survival",
    tagline: "Scored leaderboard run",
    blurb: "Harder mode with demand surges, Lost/min pressure, badges, and the global leaderboard. Survive as long as you can.",
    goals: false,
    bankruptcy: false,
    networkPressure: true,
    demandScaleMult: 1.75,
    growth: {
      shape: "compound",
      perDayBase: 0.078,
      perThousandServed: 0.08,
      maxMultiplier: 1e6,
      costGrowthPerDay: 0.05,
    },
    crowding: {
      platformBase: { usa: 150, nyc: 100 },
      platformPerDemand: 12,
      usePopScale: true,
      platformPop2Exp: 0.75,
      platformPopMult: 45,
      minTrainMultiple: 1.5,
    },
    pressure: PRESSURE_DEFAULTS,
  },
};

export function getGameMode(state) {
  const id = state?.gameMode ?? "survival";
  return GAME_MODES[id] ?? GAME_MODES.survival;
}

export function isSurvivalMode(state) {
  return (state?.gameMode ?? "survival") === "survival";
}

/** Rolling lost-rate collapse mechanic (Survival only). */
export function networkPressureEnabled(state) {
  return isSurvivalMode(state);
}

export function getPressureConfig(state) {
  return getGameMode(state).pressure ?? PRESSURE_DEFAULTS;
}

/** True after the player buys the NYC detail map. */
export function cityMapsUnlocked(state) {
  return !!state.cityMapsUnlocked;
}

export function canAffordCityMap(state) {
  return state.cash >= ECON.cityMapPurchasePrice;
}

export const fmtSimDuration = (sec) => {
  const s = Math.max(0, Math.floor(sec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${r}s`;
  return `${r}s`;
};

export const PRICING = {
  minMult: 0.5,
  maxMult: 2.0,
  elasticity: 0.6,
};

export function demandElasticity(fareMult) {
  return Math.max(0.3, 1 - (fareMult - 1) * PRICING.elasticity);
}

/** Rider patience in seconds. Higher fare multipliers reduce patience in Survival mode. */
export function getRiderPatienceSec(state, mapKey) {
  const basePatience = CROWDING.patienceSec;
  if (!isSurvivalMode(state)) return basePatience;
  const ms = state.maps?.[mapKey];
  const fareMult = ms ? ms.fareMult : 1.0;
  const mult = 1 + (fareMult - 1) * 1.35;
  return Math.round(basePatience / mult);
}

export const fmtMoney = (v) => {
  const sign = v < 0 ? "-" : "";
  v = Math.abs(v);
  if (v >= 1e6) return `${sign}$${(v / 1e6).toFixed(2)}M`;
  if (v >= 1e3) return `${sign}$${(v / 1e3).toFixed(1)}k`;
  return `${sign}$${Math.round(v)}`;
};

export const fmtInt = (v) => Math.round(v).toLocaleString("en-US");
