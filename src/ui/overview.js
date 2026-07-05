import { ECON, fmtMoney, fmtInt, cityMapsUnlocked } from "../core/config.js";
import { platformCapacity, formatCrowdingStat } from "../core/economy.js";
import { icon } from "./icons.js";

const MAP_LABELS = { usa: "USA network", nyc: "NYC network" };

function stationRows(state) {
  const rows = [];
  for (const mapKey of ["usa", "nyc"]) {
    for (const node of Object.values(state.maps[mapKey].nodes)) {
      if (!node.station) continue;
      const waiting = node.waiting.reduce((s, g) => s + g.count, 0);
      const cap = platformCapacity(mapKey, node, state);
      rows.push({
        mapKey,
        id: node.id,
        name: node.name,
        waiting,
        cap,
        crowded: node.crowded,
        platform: formatCrowdingStat(mapKey, node, state),
        served: node.servedTotal,
      });
    }
  }
  return rows.sort((a, b) => {
    if (a.crowded !== b.crowded) return (b.crowded ? 1 : 0) - (a.crowded ? 1 : 0);
    const pctA = a.cap > 0 ? a.waiting / a.cap : 0;
    const pctB = b.cap > 0 ? b.waiting / b.cap : 0;
    return pctB - pctA;
  });
}

function renderStationRow(row) {
  const pct = row.cap > 0 ? Math.min(100, Math.round((row.waiting / row.cap) * 100)) : 0;
  const status = row.crowded ? "crowded" : pct >= 70 ? "warn" : "";
  return `
    <button type="button" class="overview-row ${status}" data-map="${row.mapKey}" data-node="${row.id}">
      <div class="overview-row-head">
        <span class="overview-name">${row.name}</span>
        <span class="overview-map-tag">${row.mapKey === "usa" ? "USA" : "NYC"}</span>
      </div>
      <div class="overview-platform">${row.platform}</div>
      <div class="overview-bar"><div class="overview-bar-fill" style="width:${pct}%"></div></div>
      <div class="overview-meta">Delivered here · ${fmtInt(row.served)}</div>
    </button>
  `;
}

export function openNetworkOverview(game) {
  const s = game.state;
  const rows = stationRows(s);
  const crowded = rows.filter((r) => r.crowded).length;
  const nycLocked = !cityMapsUnlocked(s);

  const empty = rows.length
    ? ""
    : `<div class="overview-empty">No stations yet — build stops on the map to see platform status here.</div>`;

  const lockNote = nycLocked
    ? `<div class="overview-note">${icon("lock")} NYC detail map unlocks at <b>${fmtMoney(ECON.cityMapUnlockCash)}</b> cash — enter via New York City on the USA map.</div>`
    : "";

  const mapActions = s.currentMap === "nyc"
    ? `<button class="btn quiet" data-map="usa">${icon("map")} Return to USA map</button>`
    : "";

  const backdrop = document.createElement("div");
  backdrop.className = "modal-backdrop";
  backdrop.innerHTML = `
    <div class="modal goals-modal overview-modal">
      <h2>${icon("passengers")} Network overview</h2>
      <div class="sub">${fmtInt(rows.length)} station${rows.length === 1 ? "" : "s"}${crowded ? ` · <span class="overview-alert">${fmtInt(crowded)} overcrowded</span>` : ""}</div>
      ${lockNote}
      <div class="overview-list">${rows.map(renderStationRow).join("")}${empty}</div>
      <div class="modal-footer">
        ${mapActions}
        <button class="btn quiet" data-close>Close</button>
      </div>
    </div>
  `;

  document.getElementById("hud").appendChild(backdrop);
  const close = () => backdrop.remove();
  backdrop.addEventListener("click", (e) => { if (e.target === backdrop) close(); });
  backdrop.querySelector("[data-close]").addEventListener("click", close);

  backdrop.querySelectorAll(".overview-row").forEach((btn) => {
    btn.addEventListener("click", () => {
      const mapKey = btn.dataset.map;
      if (mapKey === "nyc" && !cityMapsUnlocked(s)) {
        close();
        game.switchMap("nyc");
        return;
      }
      if (!game.switchMap(mapKey)) return;
      game.inspector.showNode(btn.dataset.node);
      close();
    });
  });

  backdrop.querySelector('[data-map="usa"]')?.addEventListener("click", () => {
    game.switchMap("usa");
    close();
  });
}
