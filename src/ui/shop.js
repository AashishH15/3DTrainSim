import { TIERS, fmtMoney, fmtInt, fmtSimDuration, GAME_MODES } from "../core/config.js";
import { trainPurchaseCost, costMultiplier } from "../core/economy.js";
import { lostRatePerMin, displaySimTime } from "../sim/simulation.js";
import { formatSurvivalBest, recordSurvivalBest } from "../core/survivalBest.js";
import { badgesSummary, evaluateSurvivalBadges } from "../core/survivalBadges.js";
import { isOfficialRun } from "../core/integrity.js";
import { getSavedHandle, submitLeaderboardScore } from "../core/leaderboard.js";
import { recordRunResult, markRunLeaderboardSubmitted } from "../core/runHistory.js";
import { saveState } from "../core/state.js";
import { openLeaderboardModal } from "./leaderboardModal.js";
import { icon } from "./icons.js";
import { shareModalActions, bindShareAction } from "./share.js";
import { REPO_URL, loadStarCount } from "./githubStar.js";

export function openModePicker(game, onPick) {
  const backdrop = document.createElement("div");
  backdrop.className = "modal-backdrop";
  backdrop.id = "mode-picker-backdrop";
  const best = formatSurvivalBest();

  const modeOrder = [GAME_MODES.survival, GAME_MODES.tycoon];
  const cards = modeOrder.map((m) => `
    <button type="button" class="mode-card" data-mode="${m.id}">
      <div class="mode-card-head">
        ${icon(m.id === "survival" ? "close" : "medal")}
        <div>
          <h4>${m.name}</h4>
          <div class="mode-tagline">${m.tagline}</div>
        </div>
      </div>
      <p class="mode-blurb">${m.blurb}</p>
      ${m.id === "survival" && best ? `<div class="mode-best">Personal best · ${best}</div>` : ""}
      <span class="mode-cta">Play ${m.name}</span>
    </button>
  `).join("");

  backdrop.innerHTML = `
    <div class="modal mode-picker-modal">
      <h2>${icon("train")} Choose your run</h2>
      <div class="sub">Same maps and tools — Tycoon has win conditions; Survival has no ceiling, just your best time.</div>
      <div class="mode-cards">${cards}</div>
    </div>
  `;
  backdrop.querySelector(".mode-picker-modal .sub").textContent =
    "Tycoon is relaxed creative building. Survival is the harder scored run with badges and the global leaderboard.";
  document.getElementById("hud").appendChild(backdrop);

  backdrop.querySelectorAll("[data-mode]").forEach((b) =>
    b.addEventListener("click", () => {
      backdrop.remove();
      onPick(b.dataset.mode);
    })
  );
}

export function openShop(game) {
  // Prevent opening multiple shop modals
  if (document.querySelector(".shop-backdrop")) return;

  const backdrop = document.createElement("div");
  backdrop.className = "modal-backdrop shop-backdrop";
  backdrop.style.zIndex = "200";
  const mapKey = game.state.currentMap;

  const costMult = costMultiplier(game.state);
  const cards = Object.values(TIERS).map((t) => {
    const scaledPrice = trainPurchaseCost(t.id, game.state);
    const scaledOps = Math.round(t.opsPerMin * costMult);
    return `
      <div class="tier-card">
        ${icon(`tier${t.id}`)}
        <h4>${t.name}</h4>
        <div class="desc">${t.desc}</div>
        <div class="spec"><span>Speed</span><b>${t.speed[mapKey]} u/s</b></div>
        <div class="spec"><span>Capacity</span><b>${fmtInt(t.capacity)}</b></div>
        <div class="spec"><span>Track</span><b>${t.minTrack}</b></div>
        <div class="spec"><span>Fare bonus</span><b>×${t.fareMult}</b></div>
        <div class="spec"><span>Running cost</span><b>${fmtMoney(scaledOps)}/min</b></div>
        <div class="price">${fmtMoney(scaledPrice)}</div>
        <button class="btn primary" data-tier="${t.id}">Buy</button>
      </div>
    `;
  }).join("");

  backdrop.innerHTML = `
    <div class="modal">
      <h2>${icon("train")} Train shop</h2>
      <div class="sub">Buying for the <b>${mapKey === "usa" ? "USA national" : "New York City"}</b> network. After purchase you'll pick the stops on its route.</div>
      <div class="tier-cards">${cards}</div>
      <div class="modal-footer">
        <button class="btn quiet" data-close>Close</button>
      </div>
    </div>
  `;
  document.getElementById("hud").appendChild(backdrop);

  const close = () => backdrop.remove();
  backdrop.addEventListener("click", (e) => { if (e.target === backdrop) close(); });
  backdrop.querySelector("[data-close]").addEventListener("click", close);
  backdrop.querySelectorAll("[data-tier]").forEach((b) =>
    b.addEventListener("click", () => {
      if (game.buyTrain(+b.dataset.tier)) close();
    })
  );
}

export function openGameOver(game) {
  if (game.state.collapseReason === "network" || game.state.collapseReason === "surge") {
    openNetworkCollapse(game);
    return;
  }
  recordRunResult(game.state);
  saveState(game.state);
  const backdrop = document.createElement("div");
  backdrop.className = "modal-backdrop";
  backdrop.innerHTML = `
    <div class="modal" style="text-align:center; width:min(28rem,92vw);">
      <h2 style="justify-content:center;">${icon("coins")} Bankrupt</h2>
      <div class="sub" style="margin:0.6rem 0 1.2rem;">
        Your rail empire ran out of money. You delivered ${fmtInt(game.state.totalDelivered)} passengers
        and earned ${fmtMoney(game.state.totalRevenue)} in fares.
      </div>
      <div class="modal-footer" style="justify-content:center; flex-wrap:wrap;">
        ${shareModalActions(true)}
        <button class="btn quiet" data-restart>Start a new empire</button>
      </div>
    </div>
  `;
  document.getElementById("hud").appendChild(backdrop);
  bindShareAction(backdrop, game, { headline: "Bankrupt" });
  backdrop.querySelector("[data-restart]").addEventListener("click", () => {
    backdrop.remove();
    game.newGame();
  });
}

export function openNetworkCollapse(game) {
  const s = game.state;
  evaluateSurvivalBadges(s);
  const record = recordRunResult(s);
  saveState(s);
  const runSec = s.survivalTime || displaySimTime(s);
  const { isNew, bestSec, previousSec } = recordSurvivalBest(runSec);
  const { done, total } = badgesSummary();
  const bestLabel = fmtSimDuration(bestSec);
  const official = isOfficialRun(s);

  const submitSection = official && runSec > 0 ? `
    <div class="lb-submit-box" style="margin:1rem 0 1rem; padding:0.75rem; border-radius:8px; background:rgba(42,109,181,0.12); border:1px solid rgba(42,109,181,0.3); text-align:left;">
      <div style="font-weight:bold; font-size:0.85rem; margin-bottom:0.3rem; color:#edf1f6; display:flex; align-items:center; gap:0.4rem;">
        ${icon("trophy")} Global Leaderboard
      </div>
      <div style="font-size:0.76rem; color:#97a3b4; margin-bottom:0.5rem;">
        Official run verified! Submit your survival record of <b>${fmtSimDuration(runSec)}</b>:
      </div>
      <div style="display:flex; gap:0.4rem;">
        <input type="text" id="lb-handle-input" placeholder="Enter handle (max 20 chars)" maxlength="20" value="${getSavedHandle()}" style="flex:1; padding:0.4rem 0.6rem; border-radius:4px; border:1px solid rgba(255,255,255,0.2); background:rgba(0,0,0,0.4); color:#fff; font-size:0.85rem;" />
        <button class="btn primary small" id="lb-submit-btn">Submit</button>
      </div>
      <div id="lb-submit-msg" style="font-size:0.76rem; margin-top:0.4rem; min-height:1rem;"></div>
    </div>
  ` : "";

  const collapseSubtitle = s.collapseReason === "surge"
    ? `Network collapsed — 5 demand surges were abandoned.`
    : `Too many riders gave up waiting. Your network couldn't keep pace with station demand.`;

  const backdrop = document.createElement("div");
  backdrop.className = "modal-backdrop";
  backdrop.innerHTML = `
    <div class="modal" style="text-align:center; width:min(28rem,92vw);">
      <h2 style="justify-content:center;">${icon("close")} Network collapsed</h2>
      <div class="sub" style="margin:0.6rem 0 0.4rem;">
        ${collapseSubtitle}
      </div>
      <div class="stat" style="align-items:center; margin:1rem 0 0.5rem;">
        <div class="v" style="font-size:1.6rem; color:var(--accent);">${fmtSimDuration(runSec)}</div>
        <div class="k">Survived</div>
      </div>
      <div class="sub" style="font-size:0.82rem; margin-bottom:0.35rem;">
        ${isNew
      ? `<b style="color:var(--good);">New personal best!</b>${previousSec > 0 ? ` (was ${fmtSimDuration(previousSec)})` : ""}`
      : runSec === bestSec
        ? `Matched your personal best · <b>${bestLabel}</b>`
        : `Personal best · <b>${bestLabel}</b> · ${fmtSimDuration(bestSec - runSec)} short of your record`}
      </div>
      <div class="sub" style="font-size:0.78rem; margin-bottom:0.8rem;">
        Delivered ${fmtInt(s.totalDelivered)} passengers · Peak lost rate ${fmtInt(lostRatePerMin(s))}/min · ${fmtInt(done)}/${fmtInt(total)} badges unlocked
      </div>
      ${submitSection}
      <div class="modal-footer" style="justify-content:center; flex-wrap:wrap;">
        <button class="btn quiet" data-view-lb>${icon("trophy")} Leaderboard</button>
        ${shareModalActions(true)}
        <button class="btn quiet" data-restart>Try again</button>
      </div>
    </div>
  `;
  document.getElementById("hud").appendChild(backdrop);
  bindShareAction(backdrop, game, { headline: "Network collapsed", elapsedSec: runSec });

  backdrop.querySelector("[data-view-lb]")?.addEventListener("click", () => {
    openLeaderboardModal(game, s.currentMap);
  });

  const submitBtn = backdrop.querySelector("#lb-submit-btn");
  const handleInput = backdrop.querySelector("#lb-handle-input");
  const msgEl = backdrop.querySelector("#lb-submit-msg");

  if (submitBtn && handleInput && msgEl) {
    submitBtn.addEventListener("click", async () => {
      const handle = handleInput.value.trim();
      if (!handle) {
        msgEl.style.color = "var(--bad)";
        msgEl.textContent = "Please enter a handle.";
        return;
      }
      submitBtn.disabled = true;
      handleInput.disabled = true;
      msgEl.style.color = "var(--accent)";
      msgEl.textContent = "Submitting score…";

      try {
        await submitLeaderboardScore({
          handle,
          mode: "survival",
          map: s.currentMap,
          survivedSec: runSec,
          trains: Object.keys(s.trains || {}).length,
          passengers: s.totalDelivered,
        });
        markRunLeaderboardSubmitted(record.id);
        msgEl.style.color = "var(--good)";
        msgEl.textContent = "Score submitted to Global Leaderboard!";
        game.hud.toast("Leaderboard score submitted!", "good");
        setTimeout(() => openLeaderboardModal(game, s.currentMap), 600);
      } catch (err) {
        submitBtn.disabled = false;
        handleInput.disabled = false;
        msgEl.style.color = "var(--bad)";
        msgEl.textContent = err.message || "Failed to submit score.";
      }
    });
  }

  backdrop.querySelector("[data-restart]").addEventListener("click", () => {
    backdrop.remove();
    game.newGame();
  });
}

export function openIntro(game, { firstRun = false } = {}) {
  const backdrop = document.createElement("div");
  backdrop.className = "modal-backdrop";
  backdrop.innerHTML = `
    <div class="modal" style="width:min(34rem,92vw);">
      <h2>${icon("train")} Overland</h2>
      <div class="sub">Build a profitable passenger rail network across the USA and New York City. \n Cannot promise your scores to remain, this is very early in development still trying to figure out its quarks.</div>
      <div class="steps">
        <div class="step">${icon("station")}
          <div><h4>1 · Build stations</h4>
          <p>You start in 12 major US metros. Pick the Station tool and click stops to build — gray metros let you <b>expand your network</b> into new cities as you grow.</p></div>
        </div>
        <div class="step">${icon("route")}
          <div><h4>2 · Lay track between them</h4>
          <p>Pick a track type, then click one station and then another. Water crossings in NYC build bridges at extra cost.</p></div>
        </div>
        <div class="step">${icon("train")}
          <div><h4>3 · Buy a train and set its route</h4>
          <p>Buy a train, click the stations it should serve in order, then press Done. It loops automatically and earns fares.</p></div>
        </div>
        <div class="step">${icon("coins")}
          <div><h4>4 · Reinvest the profit</h4>
          <p><b>Expand your network</b> across the US, upgrade track, and add faster trains. Milestones track every step — reach all 50 metros or $5M to win. Stay above -$250k or you go bankrupt.</p></div>
        </div>
        <div class="step">${icon("medal")}
          <div><h4>5 · Track your milestones</h4>
          <p>Open the medal button anytime to see goals, progress bars, and win conditions. The bar under the stats shows what to chase next.</p></div>
        </div>
      </div>
      <div class="controls-hint">
        <b>Drag</b> to orbit · <b>Move tool (0)</b> drag-pans without Ctrl · <b>Scroll / pinch</b> zoom ·
        <b>Right-click / Cancel</b> backs out · <b>Space</b> pauses
      </div>
      <div class="modal-footer">
        <button class="btn quiet" data-report-bug>${icon("bug")} Report bug</button>
        <a class="btn quiet github-modal-star" href="${REPO_URL}" target="_blank" rel="noopener noreferrer">
          ${icon("github")}
          <span>Star on GitHub</span>
          <span class="github-star-count" hidden>${icon("star", "github-star-icon")}<span class="github-star-n">-</span></span>
        </a>
        <button class="btn primary" data-close>${firstRun ? "Start building" : "Got it"}</button>
      </div>
    </div>
  `;
  document.getElementById("hud").appendChild(backdrop);
  const close = () => backdrop.remove();
  backdrop.addEventListener("click", (e) => { if (e.target === backdrop) close(); });
  backdrop.querySelector("[data-close]").addEventListener("click", close);
  backdrop.querySelector("[data-report-bug]")?.addEventListener("click", () => {
    game.reportBug();
  });
  const starCount = backdrop.querySelector(".github-star-count");
  const starNumber = backdrop.querySelector(".github-star-n");
  loadStarCount(starNumber).then(() => {
    if (starCount && Number(starNumber?.dataset.count || 0) >= 10) {
      starCount.hidden = false;
    }
  });
}
