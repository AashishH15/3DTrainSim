import { fmtMoney, fmtInt, fmtSimDuration } from "../core/config.js";
import { getSavedHandle, submitLeaderboardScore } from "../core/leaderboard.js";
import {
  canSubmitToLeaderboard,
  loadRunHistory,
  markRunLeaderboardSubmitted,
} from "../core/runHistory.js";
import { openLeaderboardModal } from "./leaderboardModal.js";
import { openShareModalFromRecord } from "./share.js";
import { icon } from "./icons.js";

function mapLabel(mapKey) {
  return mapKey === "nyc" ? "New York City" : "USA National";
}

function formatWhen(iso) {
  try {
    const d = new Date(iso);
    return d.toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function statusBadges(record) {
  const tags = [];
  if (record.officialRun) tags.push('<span class="run-tag official">Official</span>');
  else tags.push('<span class="run-tag unofficial">Unofficial</span>');
  if (record.leaderboardSubmitted) {
    tags.push(`<span class="run-tag submitted">${icon("trophy")} Submitted</span>`);
  } else if (canSubmitToLeaderboard(record)) {
    tags.push('<span class="run-tag pending">Not submitted</span>');
  }
  return tags.join("");
}

function runSummary(record) {
  const time = record.survival
    ? fmtSimDuration(record.survivalTime)
    : fmtSimDuration(record.simTime);
  const timeLabel = record.survival ? "Survived" : "Elapsed";
  return `${timeLabel} ${time} · ${fmtInt(record.totalDelivered)} pax · ${fmtInt(record.trainCount)} trains · ${fmtMoney(record.cash)} cash`;
}

function renderRunRow(record) {
  const canSubmit = canSubmitToLeaderboard(record);
  return `
    <div class="run-history-row" data-run-id="${escapeHtml(record.id)}">
      <div class="run-history-main">
        <div class="run-history-title">
          <span class="run-outcome">${escapeHtml(record.outcomeLabel)}</span>
          <span class="run-meta">${escapeHtml(record.modeName)} · ${mapLabel(record.mapKey)}</span>
        </div>
        <div class="run-history-stats">${runSummary(record)}</div>
        <div class="run-history-when">${formatWhen(record.recordedAt)}</div>
        <div class="run-history-tags">${statusBadges(record)}</div>
      </div>
      <div class="run-history-actions">
        <button class="btn small quiet" type="button" data-share-run title="Share this run">${icon("share")}</button>
        ${canSubmit ? `<button class="btn small primary" type="button" data-submit-run>${icon("trophy")} Submit</button>` : ""}
      </div>
    </div>
  `;
}

export function openRunHistoryModal(game) {
  if (document.getElementById("run-history-modal-backdrop")) return;

  const backdrop = document.createElement("div");
  backdrop.className = "modal-backdrop";
  backdrop.id = "run-history-modal-backdrop";
  backdrop.innerHTML = `
    <div class="modal run-history-modal" style="width:min(42rem, 94vw);">
      <div class="modal-header-row" style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.6rem;">
        <h2 style="margin:0;">${icon("history")} Past runs</h2>
      </div>
      <div class="sub" style="margin-bottom:1rem;">Review finished runs you may have missed — share or submit Survival scores to the leaderboard.</div>
      <div class="run-history-body" style="min-height:180px; max-height:55vh; overflow-y:auto; border-radius:8px; background:rgba(16,21,29,0.6); border:1px solid rgba(255,255,255,0.08);"></div>
      <div class="modal-footer" style="margin-top:1rem; display:flex; justify-content:flex-end;">
        <button class="btn quiet" data-close>Close</button>
      </div>
    </div>
  `;

  document.getElementById("hud").appendChild(backdrop);

  const close = () => backdrop.remove();
  backdrop.addEventListener("click", (e) => { if (e.target === backdrop) close(); });
  backdrop.querySelector("[data-close]")?.addEventListener("click", close);

  const bodyEl = backdrop.querySelector(".run-history-body");

  function renderList() {
    const runs = loadRunHistory();
    if (!runs.length) {
      bodyEl.innerHTML = `
        <div style="padding:3rem 1.5rem; text-align:center; color:#8a96a6;">
          No finished runs yet. Complete a Survival or Tycoon run to see it here.
        </div>
      `;
      return;
    }

    bodyEl.innerHTML = runs.map(renderRunRow).join("");

    bodyEl.querySelectorAll(".run-history-row").forEach((row) => {
      const runId = row.dataset.runId;
      const record = runs.find((r) => r.id === runId);
      if (!record) return;

      row.querySelector("[data-share-run]")?.addEventListener("click", () => {
        openShareModalFromRecord(game, record);
      });

      row.querySelector("[data-submit-run]")?.addEventListener("click", () => {
        openSubmitDialog(game, record, () => renderList());
      });
    });
  }

  renderList();
}

function openSubmitDialog(game, record, onDone) {
  if (document.getElementById("run-history-submit-backdrop")) return;

  const backdrop = document.createElement("div");
  backdrop.className = "modal-backdrop";
  backdrop.id = "run-history-submit-backdrop";
  backdrop.innerHTML = `
    <div class="modal" style="width:min(28rem, 92vw);">
      <h2>${icon("trophy")} Submit to leaderboard</h2>
      <div class="sub" style="margin:0.5rem 0 1rem;">
        Submit your official Survival run of <b>${fmtSimDuration(record.survivalTime)}</b>
        on <b>${mapLabel(record.mapKey)}</b>.
      </div>
      <div style="display:flex; gap:0.4rem; margin-bottom:0.5rem;">
        <input type="text" id="rh-lb-handle" placeholder="Enter handle (max 20 chars)" maxlength="20" value="${escapeHtml(getSavedHandle())}" style="flex:1; padding:0.4rem 0.6rem; border-radius:4px; border:1px solid rgba(255,255,255,0.2); background:rgba(0,0,0,0.4); color:#fff; font-size:0.85rem;" />
        <button class="btn primary small" id="rh-lb-submit">Submit</button>
      </div>
      <div id="rh-lb-msg" style="font-size:0.76rem; min-height:1rem;"></div>
      <div class="modal-footer" style="margin-top:1rem;">
        <button class="btn quiet" data-close>Cancel</button>
      </div>
    </div>
  `;

  document.getElementById("hud").appendChild(backdrop);

  const close = () => backdrop.remove();
  backdrop.addEventListener("click", (e) => { if (e.target === backdrop) close(); });
  backdrop.querySelector("[data-close]")?.addEventListener("click", close);

  const submitBtn = backdrop.querySelector("#rh-lb-submit");
  const handleInput = backdrop.querySelector("#rh-lb-handle");
  const msgEl = backdrop.querySelector("#rh-lb-msg");

  submitBtn?.addEventListener("click", async () => {
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
        map: record.mapKey,
        survivedSec: record.survivalTime,
        trains: record.trainCount,
        passengers: record.totalDelivered,
      });
      markRunLeaderboardSubmitted(record.id);
      msgEl.style.color = "var(--good)";
      msgEl.textContent = "Score submitted to Global Leaderboard!";
      game.hud.toast("Leaderboard score submitted!", "good");
      onDone();
      setTimeout(() => {
        close();
        openLeaderboardModal(game, record.mapKey);
      }, 500);
    } catch (err) {
      submitBtn.disabled = false;
      handleInput.disabled = false;
      msgEl.style.color = "var(--bad)";
      msgEl.textContent = err.message || "Failed to submit score.";
    }
  });
}

function escapeHtml(str) {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
