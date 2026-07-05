import { TIERS, TRACK_TYPES, fmtMoney, fmtInt, ECON, cityMapsUnlocked, canAffordCityMap } from "../core/config.js";
import { stationCost, nodeUnlockCost, upgradeCost, bulldozeRefund, formatDemandStat, formatCrowdingStat } from "../core/economy.js";
import { trainsOnEdge } from "../core/graph.js";
import { icon } from "./icons.js";

export class Inspector {
  constructor(game) {
    this.game = game;
    this.el = null;
    this.current = null; // { kind, id }
    setInterval(() => this.refresh(), 400);
  }

  close() {
    this.el?.remove();
    this.el = null;
    this.current = null;
  }

  open(html) {
    this.close();
    this.el = document.createElement("div");
    this.el.className = "inspector";
    this.el.innerHTML = `<button class="close" title="Close">${icon("close")}</button>${html}`;
    document.getElementById("hud").appendChild(this.el);
    this.el.querySelector(".close").addEventListener("click", () => this.close());
  }

  refresh() {
    if (!this.current) return;
    const { kind, id } = this.current;
    if (kind === "node") this.showNode(id, true);
    else if (kind === "train") this.showTrain(id, true);
    else if (kind === "edge") this.showEdge(id, true);
  }

  // ---------- node ----------
  showNode(nodeId, isRefresh = false) {
    const g = this.game;
    const s = g.state;
    const mapKey = s.currentMap;
    const node = s.maps[mapKey].nodes[nodeId];
    if (!node) return this.close();
    this.current = { kind: "node", id: nodeId };

    const waiting = node.waiting.reduce((a, x) => a + x.count, 0);
    const onNetwork = node.unlocked || node.station;
    const status = node.station
      ? "Station built"
      : onNetwork
        ? "On your network · no station yet"
        : "Outside your network";
    const rows = [
      ["Status", status],
      ["Demand", formatDemandStat(node, s)],
      node.pop ? ["Metro pop.", `${node.pop}M (rank ${node.rank})`] : null,
      node.station ? ["Platform", formatCrowdingStat(mapKey, node, s), node.crowded ? "crowded" : ""] : ["Waiting", fmtInt(waiting)],
      ["Delivered here", fmtInt(node.servedTotal)],
      node.station ? ["Fares", `${s.maps[mapKey].fareMult.toFixed(1)}×`] : null,
    ].filter(Boolean);

    const rowHtml = rows.map(([k, v, cls]) =>
      `<div class="row${cls ? ` row-${cls}` : ""}"><span class="k">${k}</span><span>${v}</span></div>`
    ).join("");

    const actions = [];
    const expansionNote = mapKey === "usa" && !onNetwork
      ? `<div class="sub">Expand your network here to reach this metro — counts toward milestones.</div>`
      : "";
    if (!node.unlocked) {
      actions.push(`<button class="btn primary" data-act="unlock">${icon("pin")} Expand network · ${fmtMoney(nodeUnlockCost(node))}</button>`);
    } else if (!node.station) {
      actions.push(`<button class="btn primary" data-act="station">${icon("station")} Build station for ${fmtMoney(stationCost(mapKey, node))}</button>`);
    }
    if (mapKey === "usa" && node.rank === 1) {
      if (cityMapsUnlocked(s)) {
        actions.push(`<button class="btn" data-act="enternyc">${icon("pin")} Enter NYC map</button>`);
      } else if (canAffordCityMap(s)) {
        actions.push(`<button class="btn primary" data-act="buynyc">${icon("pin")} Buy NYC map · ${fmtMoney(ECON.cityMapPurchasePrice)}</button>`);
      } else {
        actions.push(`<button class="btn" disabled title="Need ${fmtMoney(ECON.cityMapPurchasePrice)}">${icon("lock")} Buy NYC map · ${fmtMoney(ECON.cityMapPurchasePrice)}</button>`);
      }
    }
    if (mapKey === "nyc") {
      actions.push(`<button class="btn quiet" data-act="enterusa">${icon("map")} Return to USA map</button>`);
    }

    this.open(`
      <h3>${node.name}</h3>
      <div class="sub">${mapKey === "usa" ? "Metro area" : "NYC stop"}</div>
      ${expansionNote}
      ${rowHtml}
      <div class="actions">${actions.join("")}</div>
    `);

    this.el.querySelector('[data-act="unlock"]')?.addEventListener("click", () => g.unlockNode(nodeId));
    this.el.querySelector('[data-act="station"]')?.addEventListener("click", () => g.buildStation(nodeId));
    this.el.querySelector('[data-act="buynyc"]')?.addEventListener("click", () => {
      if (g.purchaseNycMap()) g.switchMap("nyc");
    });
    this.el.querySelector('[data-act="enternyc"]')?.addEventListener("click", () => g.switchMap("nyc"));
    this.el.querySelector('[data-act="enterusa"]')?.addEventListener("click", () => g.switchMap("usa"));
  }

  // ---------- edge ----------
  showEdge(edgeId, isRefresh = false) {
    const g = this.game;
    const s = g.state;
    const mapKey = s.currentMap;
    const edge = s.maps[mapKey].edges[edgeId];
    if (!edge) return this.close();
    this.current = { kind: "edge", id: edgeId };

    const ms = s.maps[mapKey];
    const tt = TRACK_TYPES[edge.type];
    const rows = [
      ["Type", tt.name],
      ["Connects", `${ms.nodes[edge.a].name} ↔ ${ms.nodes[edge.b].name}`],
      ["Length", `${edge.length.toFixed(1)} units`],
      edge.waterFrac > 0.02 ? ["Over water", `${Math.round(edge.waterFrac * 100)}% (bridge)`] : null,
      ["Maintenance", `${fmtMoney(tt.maintPerUnitPerMin * edge.length)}/min`],
    ].filter(Boolean);

    const actions = [];
    for (const up of [2, 3]) {
      if (up > edge.type) {
        actions.push(`<button class="btn" data-up="${up}">${icon("lightning")} Upgrade to ${TRACK_TYPES[up].name} for ${fmtMoney(upgradeCost(mapKey, edge, up))}</button>`);
      }
    }
    actions.push(`<button class="btn danger" data-act="remove">${icon("bulldoze")} Demolish, refund ${fmtMoney(bulldozeRefund(mapKey, edge))}</button>`);

    const onTrack = trainsOnEdge(s, mapKey, edgeId);
    const trainList = onTrack.length
      ? onTrack.map((train) => {
          const tier = TIERS[train.tier];
          const load = train.passengers.reduce((a, x) => a + x.count, 0);
          const along = edge.length > 0 ? Math.round((train.prog / edge.length) * 100) : 0;
          return `<button class="btn quiet train-pick" data-train="${train.id}">
            ${icon(`tier${train.tier}`)} Train #${train.num}
            <span class="train-pick-meta">${load}/${tier.capacity} · ${along}% along</span>
          </button>`;
        }).join("")
      : `<div class="train-pick-empty">No trains on this segment right now</div>`;

    this.open(`
      <h3>Track segment</h3>
      <div class="sub">${tt.name}</div>
      ${rows.map(([k, v]) => `<div class="row"><span class="k">${k}</span><span>${v}</span></div>`).join("")}
      <div class="train-list">
        <div class="train-list-label">Trains on this track</div>
        ${trainList}
      </div>
      <div class="actions">${actions.join("")}</div>
    `);

    this.el.querySelectorAll("[data-train]").forEach((b) =>
      b.addEventListener("click", () => g.inspectTrain(b.dataset.train))
    );

    this.el.querySelectorAll("[data-up]").forEach((b) =>
      b.addEventListener("click", () => g.upgradeEdge(edgeId, +b.dataset.up))
    );
    this.el.querySelector('[data-act="remove"]')?.addEventListener("click", () => g.removeEdgeAction(edgeId));
  }

  // ---------- train ----------
  showTrain(trainId, isRefresh = false) {
    const g = this.game;
    const s = g.state;
    const train = s.trains[trainId];
    if (!train) return this.close();
    this.current = { kind: "train", id: trainId };

    const tier = TIERS[train.tier];
    const ms = s.maps[train.map];
    const load = train.passengers.reduce((a, x) => a + x.count, 0);
    const routeNames = train.route.map((id) => ms.nodes[id]?.name ?? "?").join(" → ");
    const rows = [
      ["Tier", tier.name],
      ["Speed", `${tier.speed[train.map]} u/s`],
      ["Load", `${fmtInt(load)} / ${tier.capacity}`],
      ["State", train.state],
      ["Route", train.route.length >= 2 ? routeNames : "not set"],
      ["Lifetime revenue", fmtMoney(train.revenueTotal)],
      ["Operating cost", `${fmtMoney(tier.opsPerMin)}/min`],
    ];

    this.open(`
      <h3>${tier.short} Train #${train.num}</h3>
      <div class="sub">${train.map === "usa" ? "National network" : "NYC network"}</div>
      ${rows.map(([k, v]) => `<div class="row"><span class="k">${k}</span><span>${v}</span></div>`).join("")}
      <div class="actions">
        <button class="btn primary" data-act="route">${icon("route")} Set route</button>
        <button class="btn danger" data-act="sell">${icon("coins")} Sell for ${fmtMoney(tier.price * 0.5)}</button>
      </div>
    `);

    this.el.querySelector('[data-act="route"]').addEventListener("click", () => {
      this.close();
      g.startRouteAssign(trainId);
    });
    this.el.querySelector('[data-act="sell"]').addEventListener("click", () => g.sellTrain(trainId));
  }
}
