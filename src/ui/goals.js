import {
  GOALS,
  evaluateNewGoals,
  goalProgressLabel,
  goalProgressRatio,
  goalsSummary,
  nextIncompleteGoal,
  syncGoalProgress as syncTycoonGoalProgress,
} from "../core/goals.js";
import {
  SURVIVAL_BADGES,
  badgesSummary,
  evaluateSurvivalBadges,
  loadUnlockedBadges,
  nextLockedBadge,
  badgeProgressRatio,
  formatBadgeProgressShort,
  formatSimMinutes,
} from "../core/survivalBadges.js";
import { formatSurvivalBest } from "../core/survivalBest.js";
import { fmtInt, getGameMode } from "../core/config.js";
import { icon } from "./icons.js";
import { shareModalActions, bindShareAction } from "./share.js";
import { recordRunResult } from "../core/runHistory.js";
import { saveState } from "../core/state.js";

function badgeStatusLabel(badge, state, unlocked) {
  if (unlocked.has(badge.id)) {
    return `<span class="goal-status done">${icon("check")} Unlocked</span>`;
  }
  const ratio = badgeProgressRatio(badge, state);
  if (ratio != null) {
    const p = badge.progress(state);
    let label;
    if (badge.progressUnit === "time") {
      label = `${formatSimMinutes(p.current)} / ${formatSimMinutes(p.target)}`;
    } else if (p.target >= 1000) {
      label = `${fmtInt(Math.min(p.current, p.target))} / ${fmtInt(p.target)}`;
    } else {
      label = `${Math.min(p.current, p.target)} / ${p.target}`;
    }
    return `<span class="goal-status">${label}</span>`;
  }
  return `<span class="goal-status">In progress</span>`;
}

export function openGoals(game) {
  if (getGameMode(game.state).goals) openTycoonGoals(game);
  else openSurvivalBadges(game);
}

function openTycoonGoals(game) {
  const s = game.state;
  const { done, total } = goalsSummary(s);
  const doneSet = new Set(s.completedGoals);

  const rows = GOALS.map((g) => {
    const complete = doneSet.has(g.id);
    const ratio = complete ? 1 : goalProgressRatio(g, s);
    const bar = ratio != null
      ? `<div class="goal-bar"><div class="goal-bar-fill" style="width:${Math.round(ratio * 100)}%"></div></div>`
      : "";
    const meta = complete
      ? `<span class="goal-status done">${icon("check")} Complete</span>`
      : `<span class="goal-status">${goalProgressLabel(g, s)}</span>`;
    return `
      <div class="goal-row ${complete ? "complete" : ""} ${g.win ? "win" : ""}">
        <div class="goal-head">
          <span class="goal-title">${g.title}${g.win ? icon("star", "goal-star") : ""}</span>
          ${meta}
        </div>
        <div class="goal-desc">${g.desc}</div>
        ${complete ? "" : bar}
      </div>
    `;
  }).join("");

  const backdrop = document.createElement("div");
  backdrop.className = "modal-backdrop";
  backdrop.innerHTML = `
    <div class="modal goals-modal">
      <h2>${icon("medal")} Milestones</h2>
      <div class="sub">${fmtInt(done)} of ${fmtInt(total)} complete · keep expanding to hit a win condition</div>
      <div class="goals-list">${rows}</div>
      <div class="modal-footer">
        <button class="btn quiet" data-close>Close</button>
      </div>
    </div>
  `;
  document.getElementById("hud").appendChild(backdrop);
  const close = () => backdrop.remove();
  backdrop.addEventListener("click", (e) => { if (e.target === backdrop) close(); });
  backdrop.querySelector("[data-close]").addEventListener("click", close);
}

function openSurvivalBadges(game) {
  const s = game.state;
  const { done, total } = badgesSummary();
  const unlocked = loadUnlockedBadges();
  const best = formatSurvivalBest();

  const categories = ["Duration", "Skill", "Network", "Expert", "Capstone"];
  const rows = categories.map((cat) => {
    const items = SURVIVAL_BADGES.filter((b) => b.category === cat).map((b) => {
      const complete = unlocked.has(b.id);
      const ratio = complete ? 1 : badgeProgressRatio(b, s);
      const bar = ratio != null && !complete
        ? `<div class="goal-bar"><div class="goal-bar-fill" style="width:${Math.round(ratio * 100)}%"></div></div>`
        : "";
      return `
        <div class="goal-row ${complete ? "complete" : ""} ${b.capstone ? "win" : ""}">
          <div class="goal-head">
            <span class="goal-title">${b.title}${b.capstone ? icon("star", "goal-star") : ""}</span>
            ${badgeStatusLabel(b, s, unlocked)}
          </div>
          <div class="goal-desc">${b.desc}</div>
          ${complete ? "" : bar}
        </div>
      `;
    }).join("");
    return `<div class="goal-category"><div class="goal-category-label">${cat}</div>${items}</div>`;
  }).join("");

  const backdrop = document.createElement("div");
  backdrop.className = "modal-backdrop";
  backdrop.innerHTML = `
    <div class="modal goals-modal">
      <h2>${icon("medal")} Survival badges</h2>
      <div class="sub">${fmtInt(done)} of ${fmtInt(total)} badges unlocked${best ? ` · Personal best <b>${best}</b>` : ""}</div>
      <div class="goals-list">${rows}</div>
      <div class="modal-footer">
        <button class="btn quiet" data-close>Close</button>
      </div>
    </div>
  `;
  document.getElementById("hud").appendChild(backdrop);
  const close = () => backdrop.remove();
  backdrop.addEventListener("click", (e) => { if (e.target === backdrop) close(); });
  backdrop.querySelector("[data-close]").addEventListener("click", close);
}

export function openVictory(game, goal) {
  const s = game.state;
  recordRunResult(s, { victoryGoal: goal.title });
  saveState(s);
  const backdrop = document.createElement("div");
  backdrop.className = "modal-backdrop";
  backdrop.innerHTML = `
    <div class="modal" style="text-align:center; width:min(30rem,92vw);">
      <h2 style="justify-content:center;">${icon("medal")} Victory</h2>
      <div class="sub" style="margin:0.5rem 0 0.2rem; font-size:1rem; color:var(--ink);">
        <b>${goal.title}</b>
      </div>
      <div class="sub" style="margin:0.2rem 0 1.1rem;">
        ${goal.desc}. You delivered ${fmtInt(s.totalDelivered)} passengers — the sandbox stays open if you want to keep building.
      </div>
      <div class="modal-footer" style="justify-content:center; flex-wrap:wrap;">
        ${shareModalActions()}
        <button class="btn primary" data-close>Keep playing</button>
      </div>
    </div>
  `;
  document.getElementById("hud").appendChild(backdrop);
  bindShareAction(backdrop, game, { headline: goal.title });
  backdrop.querySelector("[data-close]").addEventListener("click", () => backdrop.remove());
}

export function formatNextGoal(state) {
  if (!getGameMode(state).goals) return formatNextSurvivalBadge(state);
  const next = nextIncompleteGoal(state);
  if (!next) return null;
  const label = goalProgressLabel(next, state);
  return next.progress ? `${next.title} (${label})` : next.title;
}

export function formatNextSurvivalBadge(state) {
  const next = nextLockedBadge(state);
  if (!next) return null;
  return formatBadgeProgressShort(next, state);
}

export function syncGoalProgress(state) {
  if (getGameMode(state).goals) syncTycoonGoalProgress(state);
  else evaluateSurvivalBadges(state);
}

function syncGoalProgressFromCore(state) {
  syncTycoonGoalProgress(state);
}

export { goalsSummary, nextIncompleteGoal };
