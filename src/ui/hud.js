import { TIERS, TRACK_TYPES, fmtMoney, fmtInt, PRICING, getPressureConfig, isSurvivalMode, fmtSimDuration } from "../core/config.js";
import { incomePerMin, lostRatePerMin, breachProgress, displaySimTime } from "../sim/simulation.js";
import { on } from "../core/bus.js";
import { icon } from "./icons.js";
import { formatNextGoal, goalsSummary, formatNextSurvivalBadge } from "./goals.js";
import { badgesSummary } from "../core/survivalBadges.js";
import { formatSurvivalBest } from "../core/survivalBest.js";

export class Hud {
  constructor(game) {
    this.game = game;
    this.root = document.getElementById("hud");
    this.topHud = document.createElement("div");
    this.topHud.className = "top-hud";
    this.root.appendChild(this.topHud);
    this.buildTopbar();
    this.buildGoalsStrip();
    this.buildToolbar();
    this.buildHintbar();
    this.buildToasts();
    this.buildFleet();
    on("toast", (t) => this.toast(t.msg, t.kind, t.key, t.action));
    setInterval(() => this.refresh(), 250);
    this.syncModeUi();
  }

  syncModeUi() {
    const survival = isSurvivalMode(this.game.state);
    const topbar = this.root.querySelector(".topbar");
    if (topbar) topbar.dataset.mode = survival ? "survival" : "tycoon";
    if (this.goalsStrip) this.goalsStrip.style.display = "";
    const goalsBtn = document.getElementById("hud-goals");
    if (goalsBtn) {
      goalsBtn.hidden = false;
      goalsBtn.title = survival ? "Survival badges" : "Milestones";
    }
    const elapsedStat = document.getElementById("hud-elapsed-stat");
    const elapsedLabel = document.getElementById("hud-elapsed-label");
    const lostStat = document.getElementById("hud-lost-stat");
    if (elapsedStat && elapsedLabel) {
      elapsedStat.hidden = false;
      elapsedStat.style.display = "";
      elapsedStat.classList.toggle("stat-survival", survival);
      elapsedLabel.textContent = survival ? "Survived" : "Time elapsed";
      elapsedStat.title = survival ? "Elapsed survival time" : "Elapsed sim time";
    }
    const strikesStat = document.getElementById("hud-strikes-stat");
    if (lostStat) {
      lostStat.hidden = !survival;
      lostStat.style.display = survival ? "" : "none";
    }
    if (strikesStat) {
      strikesStat.hidden = !survival;
      strikesStat.style.display = survival ? "" : "none";
    }
    this.refreshGoals();
  }

  buildTopbar() {
    const el = document.createElement("div");
    el.className = "topbar";
    el.innerHTML = `
      <div class="topbar-stats">
        <div class="stat" title="Cash"><div class="v cash" id="hud-cash"></div><div class="k">Cash</div></div>
        <div class="stat" title="Income per minute"><div class="v" id="hud-income"></div><div class="k">Income / min</div></div>
        <div class="stat" title="Passengers delivered"><div class="v" id="hud-pax"></div><div class="k">Passengers</div></div>
        <div class="stat" id="hud-elapsed-stat" title="Elapsed time">
          <div class="v" id="hud-elapsed"></div><div class="k" id="hud-elapsed-label">Time elapsed</div>
        </div>
        <div class="stat stat-lost" id="hud-lost-stat" title="Riders lost per minute" hidden>
          <div class="v" id="hud-lost"></div><div class="k" id="hud-lost-label">Lost</div>
        </div>
        <div class="stat stat-strikes" id="hud-strikes-stat" title="Abandoned demand surges (5 max before collapse)" hidden>
          <div class="v" id="hud-strikes">0 / 5</div><div class="k" id="hud-strikes-label">Strikes</div>
        </div>
        <div class="stat" title="Trains owned"><div class="v" id="hud-trains"></div><div class="k">Trains</div></div>
      </div>
      <div class="topbar-actions">
        <div class="speed-group">
          <button class="btn small" data-speed="0" title="Pause (Space)">${icon("pause")}</button>
          <button class="btn small" data-speed="1" title="Normal speed">1×</button>
          <button class="btn small" data-speed="2" title="Double speed">2×</button>
          <button class="btn small" data-speed="4" title="Quadruple speed">4×</button>
        </div>
        <div class="fare-group" title="Ticket fares for this map (higher fares reduce ridership)">
          <button class="btn small" data-fare="-0.1">−</button>
          <div class="v" id="hud-fare">1.0×</div>
          <button class="btn small" data-fare="0.1">+</button>
        </div>
        <button class="btn quiet small" id="hud-overview" title="Network overview (O)">${icon("passengers")}</button>
        <button class="btn quiet small" id="hud-share" title="Share your run">${icon("share")}</button>
        <button class="btn quiet small" id="hud-goals" title="Milestones">${icon("medal")}</button>
        <button class="btn quiet small" id="hud-help" title="How to play">${icon("info")}</button>
        <button class="btn quiet small" id="hud-leaderboard" title="Global Survival Leaderboard">${icon("trophy")}</button>
        <button class="btn quiet small danger" id="hud-newgame" title="Start over">${icon("restart")}</button>
      </div>
    `;
    this.topHud.appendChild(el);
    el.querySelectorAll("[data-speed]").forEach((b) =>
      b.addEventListener("click", () => { this.game.state.speed = +b.dataset.speed; })
    );
    el.querySelectorAll("[data-fare]").forEach((b) =>
      b.addEventListener("click", () => {
        const ms = this.game.state.maps[this.game.state.currentMap];
        ms.fareMult = Math.max(
          PRICING.minMult,
          Math.min(PRICING.maxMult, +(ms.fareMult + Number(b.dataset.fare)).toFixed(1))
        );
        this.refresh();
      })
    );
    el.querySelector("#hud-overview").addEventListener("click", () => this.game.openOverview());
    el.querySelector("#hud-share").addEventListener("click", () => this.game.openShare());
    el.querySelector("#hud-goals").addEventListener("click", () => this.game.openGoals());
    el.querySelector("#hud-leaderboard").addEventListener("click", () => this.game.openLeaderboard());
    el.querySelector("#hud-help").addEventListener("click", () => this.game.openIntro());
    el.querySelector("#hud-newgame").addEventListener("click", () => {
      if (confirm("Start a new game? Current progress will be erased.")) this.game.newGame();
    });
  }

  buildGoalsStrip() {
    this.goalsStrip = document.createElement("div");
    this.goalsStrip.className = "goals-strip";
    this.goalsStrip.addEventListener("click", () => this.game.openGoals());
    this.topHud.appendChild(this.goalsStrip);
    this.refreshGoals();
  }

  refreshGoals() {
    if (!this.goalsStrip) return;
    const s = this.game.state;
    const survival = isSurvivalMode(s);

    if (survival) {
      const { done, total } = badgesSummary();
      const best = formatSurvivalBest();
      const next = formatNextSurvivalBadge(s);
      const bestLine = best ? `<span class="goals-best">Best ${best}</span>` : "";
      if (!next) {
        this.goalsStrip.innerHTML = `${icon("medal")}<span>All badges unlocked</span>${bestLine}<span class="goals-count">${done}/${total}</span>`;
        this.goalsStrip.classList.add("done");
        return;
      }
      this.goalsStrip.classList.remove("done");
      this.goalsStrip.innerHTML = `${icon("medal")}<span><b>Next:</b> ${next}</span>${bestLine}<span class="goals-count">${done}/${total}</span>`;
      return;
    }

    const { done, total } = goalsSummary(s);
    const next = formatNextGoal(s);
    if (!next) {
      this.goalsStrip.innerHTML = `${icon("medal")}<span>All milestones complete</span>`;
      this.goalsStrip.classList.add("done");
      return;
    }
    this.goalsStrip.classList.remove("done");
    this.goalsStrip.innerHTML = `${icon("medal")}<span><b>Next:</b> ${next}</span><span class="goals-count">${done}/${total}</span>`;
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
    const show = !!html;
    this.hintbar.style.display = show ? "flex" : "none";
    this.hintbar.classList.toggle("visible", show);
  }

  buildToasts() {
    this.toasts = document.createElement("div");
    this.toasts.className = "toasts";
    this.root.appendChild(this.toasts);
  }

  toast(msg, kind = "", key = "", action = null) {
    if (key) {
      for (const existing of this.toasts.children) {
        if (existing.dataset.toastKey === key) return;
      }
    }
    const t = document.createElement("div");
    t.className = `toast ${kind}`;
    if (key) t.dataset.toastKey = key;
    const glyph = kind === "good" ? "check" : kind === "bad" ? "close" : "info";
    t.innerHTML = `${icon(glyph)}<div class="toast-content"></div>`;
    t.querySelector(".toast-content").textContent = msg;

    if (action) {
      const btn = document.createElement("button");
      btn.className = "btn small primary toast-action";
      btn.textContent = action.label || "View";
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        action.onClick?.();
        t.remove();
      });
      t.appendChild(btn);
    }

    this.toasts.appendChild(t);
    setTimeout(() => t.remove(), 4500);
    while (this.toasts.children.length > 3) this.toasts.firstChild.remove();
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
    const elapsedEl = document.getElementById("hud-elapsed");
    if (elapsedEl) elapsedEl.textContent = fmtSimDuration(displaySimTime(s));

    const survival = isSurvivalMode(s);
    const topbar = this.root.querySelector(".topbar");
    if (topbar) topbar.dataset.mode = survival ? "survival" : "tycoon";

    const lostStat = document.getElementById("hud-lost-stat");
    const lostEl = document.getElementById("hud-lost");
    const lostLabel = document.getElementById("hud-lost-label");
    const strikesStat = document.getElementById("hud-strikes-stat");
    const strikesEl = document.getElementById("hud-strikes");

    if (!survival) {
      if (lostStat) {
        lostStat.hidden = true;
        lostStat.style.display = "none";
        lostStat.classList.remove("warn", "critical");
      }
      if (strikesStat) {
        strikesStat.hidden = true;
        strikesStat.style.display = "none";
        strikesStat.classList.remove("warn", "critical");
      }
    } else {
      if (lostStat && lostEl && lostLabel) {
        lostStat.hidden = false;
        lostStat.style.display = "";
        const rate = lostRatePerMin(s);
        const progress = breachProgress(s);
        const pressureCfg = getPressureConfig(s);
        const threshold = pressureCfg.rateThresholdPerMin;
        lostLabel.textContent = "Lost / min";
        lostEl.textContent = fmtInt(rate);
        lostStat.title = progress > 0
          ? `Riders lost per sim-minute (threshold ${threshold}). Collapse in ${fmtSimDuration(pressureCfg.collapseGraceSec - s.breachTimer)} if pressure continues.`
          : `Riders lost per sim-minute (threshold ${threshold})`;
        lostStat.classList.toggle("warn", rate >= threshold * 0.5);
        lostStat.classList.toggle("critical", progress >= 0.5);
      }
      if (strikesStat && strikesEl) {
        strikesStat.hidden = false;
        strikesStat.style.display = "";
        const count = s.surgeState?.abandonedCount || 0;
        strikesEl.textContent = `${count} / 5`;
        strikesStat.title = `Abandoned demand surges: ${count} of 5 max strikes before collapse`;
        strikesStat.classList.toggle("warn", count >= 3 && count < 4);
        strikesStat.classList.toggle("critical", count >= 4);
      }
    }
    document.getElementById("hud-trains").textContent = Object.keys(s.trains).length;
    document.getElementById("hud-fare").textContent = `${s.maps[s.currentMap].fareMult.toFixed(1)}×`;

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
    this.fleet.style.display = chips.length ? "flex" : "none";
    this.fleet.querySelectorAll("[data-train]").forEach((c) =>
      c.addEventListener("click", () => this.game.inspectTrain(c.dataset.train))
    );
  }
}
