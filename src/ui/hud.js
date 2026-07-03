import { TIERS, TRACK_TYPES, fmtMoney, fmtInt } from "../core/config.js";
import { incomePerMin } from "../sim/simulation.js";
import { on } from "../core/bus.js";
import { icon } from "./icons.js";

export class Hud {
  constructor(game) {
    this.game = game;
    this.root = document.getElementById("hud");
    this.buildTopbar();
    this.buildToolbar();
    this.buildHintbar();
    this.buildToasts();
    this.buildFleet();
    on("toast", (t) => this.toast(t.msg, t.kind));
    setInterval(() => this.refresh(), 250);
  }

  buildTopbar() {
    const el = document.createElement("div");
    el.className = "topbar";
    el.innerHTML = `
      <div class="stat"><div class="v cash" id="hud-cash"></div><div class="k">Cash</div></div>
      <div class="stat"><div class="v" id="hud-income"></div><div class="k">Income / min</div></div>
      <div class="stat"><div class="v" id="hud-pax"></div><div class="k">Passengers</div></div>
      <div class="stat"><div class="v" id="hud-trains"></div><div class="k">Trains</div></div>
      <div class="divider"></div>
      <div class="speed-group">
        <button class="btn small" data-speed="0" title="Pause (Space)">${icon("pause")}</button>
        <button class="btn small" data-speed="1" title="Normal speed">1×</button>
        <button class="btn small" data-speed="2" title="Double speed">2×</button>
        <button class="btn small" data-speed="4" title="Quadruple speed">4×</button>
      </div>
      <div class="divider"></div>
      <button class="btn" id="hud-map-toggle" title="Switch map (M)"></button>
      <button class="btn quiet small" id="hud-help" title="How to play">${icon("info")}</button>
      <button class="btn quiet small danger" id="hud-newgame" title="Start over">${icon("restart")}</button>
    `;
    this.root.appendChild(el);
    el.querySelectorAll("[data-speed]").forEach((b) =>
      b.addEventListener("click", () => { this.game.state.speed = +b.dataset.speed; })
    );
    el.querySelector("#hud-map-toggle").addEventListener("click", () => this.game.toggleMap());
    el.querySelector("#hud-help").addEventListener("click", () => this.game.openIntro());
    el.querySelector("#hud-newgame").addEventListener("click", () => {
      if (confirm("Start a new game? Current progress will be erased.")) this.game.newGame();
    });
  }

  buildToolbar() {
    const el = document.createElement("div");
    el.className = "toolbar";
    this.toolbar = el;
    this.root.appendChild(el);
    this.renderToolbar();
  }

  renderToolbar() {
    const mapKey = this.game.state.currentMap;
    const t = (n) => TRACK_TYPES[n];
    const hex = (c) => `#${c.toString(16).padStart(6, "0")}`;
    const perUnit = (n) => fmtMoney(t(n).costPerUnit[mapKey]);
    this.toolbar.innerHTML = `
      <div class="section">Tools</div>
      <button class="btn tool" data-mode="pan" title="Drag to move the map">${icon("pan")}<span class="tool-label"> Move</span> <span class="key">0</span></button>
      <button class="btn tool" data-mode="select" title="Inspect stops, track and trains">${icon("select")}<span class="tool-label"> Select</span> <span class="key">1</span></button>
      <button class="btn tool" data-mode="station" title="Build a station at a stop">${icon("station")}<span class="tool-label"> Station</span> <span class="key">2</span></button>
      <div class="section">Track</div>
      <button class="btn tool" data-mode="track1" title="Tier I trains only"><span class="swatch" style="background:${hex(t(1).color)}"></span><span class="tool-label"> Standard</span> <span class="price">${perUnit(1)}/u</span><span class="key">3</span></button>
      <button class="btn tool" data-mode="track2" title="Tier I and II trains"><span class="swatch" style="background:${hex(t(2).color)}"></span><span class="tool-label"> High-Speed</span> <span class="price">${perUnit(2)}/u</span><span class="key">4</span></button>
      <button class="btn tool" data-mode="track3" title="Tier III maglev only"><span class="swatch" style="background:${hex(t(3).color)}"></span><span class="tool-label"> Maglev</span> <span class="price">${perUnit(3)}/u</span><span class="key">5</span></button>
      <div class="section">Manage</div>
      <button class="btn tool" data-mode="bulldoze" title="Demolish track for a 25% refund">${icon("bulldoze")}<span class="tool-label"> Bulldoze</span> <span class="key">6</span></button>
      <button class="btn tool" id="tool-shop" title="Buy a new train">${icon("train")}<span class="tool-label"> Buy train</span> <span class="key">B</span></button>
    `;
    this.toolbar.querySelectorAll("[data-mode]").forEach((b) =>
      b.addEventListener("click", () => this.game.setMode(b.dataset.mode))
    );
    this.toolbar.querySelector("#tool-shop").addEventListener("click", () => this.game.openShop());
    this.syncToolbar();
  }

  syncToolbar() {
    this.toolbar.querySelectorAll("[data-mode]").forEach((b) =>
      b.classList.toggle("active", b.dataset.mode === this.game.mode)
    );
  }

  buildHintbar() {
    this.hintbar = document.createElement("div");
    this.hintbar.className = "hintbar";
    this.root.appendChild(this.hintbar);
  }

  setHint(html) {
    this.hintbar.innerHTML = html;
    this.hintbar.style.display = html ? "flex" : "none";
  }

  buildToasts() {
    this.toasts = document.createElement("div");
    this.toasts.className = "toasts";
    this.root.appendChild(this.toasts);
  }

  toast(msg, kind = "") {
    const t = document.createElement("div");
    t.className = `toast ${kind}`;
    const glyph = kind === "good" ? "check" : kind === "bad" ? "close" : "info";
    t.innerHTML = `${icon(glyph)}<span></span>`;
    t.lastChild.textContent = msg;
    this.toasts.appendChild(t);
    setTimeout(() => t.remove(), 3400);
    while (this.toasts.children.length > 4) this.toasts.firstChild.remove();
  }

  buildFleet() {
    this.fleet = document.createElement("div");
    this.fleet.className = "fleet";
    this.root.appendChild(this.fleet);
  }

  refresh() {
    const s = this.game.state;
    const cashEl = document.getElementById("hud-cash");
    if (!cashEl) return;
    cashEl.textContent = fmtMoney(s.cash);
    cashEl.classList.toggle("neg", s.cash < 0);
    document.getElementById("hud-income").textContent = fmtMoney(incomePerMin(s));
    document.getElementById("hud-pax").textContent = fmtInt(s.totalDelivered);
    document.getElementById("hud-trains").textContent = Object.keys(s.trains).length;
    const toggle = document.getElementById("hud-map-toggle");
    toggle.innerHTML = s.currentMap === "usa"
      ? `${icon("pin")} NYC map`
      : `${icon("map")} USA map`;

    this.root.querySelectorAll("[data-speed]").forEach((b) =>
      b.classList.toggle("active", +b.dataset.speed === s.speed)
    );

    // Fleet chips (trains on the current map).
    const chips = [];
    for (const train of Object.values(s.trains)) {
      if (train.map !== s.currentMap) continue;
      const tier = TIERS[train.tier];
      const load = train.passengers.reduce((a, g) => a + g.count, 0);
      const noRoute = train.route.length < 2 || !train.path;
      chips.push(
        `<div class="train-chip ${noRoute ? "noroute" : ""}" data-train="${train.id}" title="${tier.name}">
          ${icon(`tier${train.tier}`)} #${train.num}
          <span class="load">${noRoute ? "needs route" : `${load}/${tier.capacity}`}</span>
        </div>`
      );
    }
    this.fleet.innerHTML = chips.join("");
    this.fleet.querySelectorAll("[data-train]").forEach((c) =>
      c.addEventListener("click", () => this.game.inspectTrain(c.dataset.train))
    );
  }
}
