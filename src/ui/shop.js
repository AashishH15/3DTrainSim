import { TIERS, fmtMoney, fmtInt } from "../core/config.js";
import { icon } from "./icons.js";

export function openShop(game) {
  const backdrop = document.createElement("div");
  backdrop.className = "modal-backdrop";
  const mapKey = game.state.currentMap;

  const cards = Object.values(TIERS).map((t) => `
    <div class="tier-card">
      ${icon(`tier${t.id}`)}
      <h4>${t.name}</h4>
      <div class="desc">${t.desc}</div>
      <div class="spec"><span>Speed</span><b>${t.speed[mapKey]} u/s</b></div>
      <div class="spec"><span>Capacity</span><b>${fmtInt(t.capacity)}</b></div>
      <div class="spec"><span>Track</span><b>${t.minTrack}</b></div>
      <div class="spec"><span>Fare bonus</span><b>×${t.fareMult}</b></div>
      <div class="spec"><span>Running cost</span><b>${fmtMoney(t.opsPerMin)}/min</b></div>
      <div class="price">${fmtMoney(t.price)}</div>
      <button class="btn primary" data-tier="${t.id}">Buy</button>
    </div>
  `).join("");

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
  const backdrop = document.createElement("div");
  backdrop.className = "modal-backdrop";
  backdrop.innerHTML = `
    <div class="modal" style="text-align:center; width:min(28rem,92vw);">
      <h2 style="justify-content:center;">${icon("coins")} Bankrupt</h2>
      <div class="sub" style="margin:0.6rem 0 1.2rem;">
        Your rail empire ran out of money. You delivered ${fmtInt(game.state.totalDelivered)} passengers
        and earned ${fmtMoney(game.state.totalRevenue)} in fares.
      </div>
      <button class="btn primary" data-restart>Start a new empire</button>
    </div>
  `;
  document.getElementById("hud").appendChild(backdrop);
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
      <h2>${icon("train")} Rail Empire</h2>
      <div class="sub">Build a profitable passenger rail network across the USA and New York City.</div>
      <div class="steps">
        <div class="step">${icon("station")}
          <div><h4>1 · Build stations</h4>
          <p>Pick the Station tool and click two stops. Bigger cities cost more but attract far more passengers.</p></div>
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
          <p>Expand to new cities, upgrade track, and unlock faster trains. Stay above -$250k or you go bankrupt.</p></div>
        </div>
      </div>
      <div class="controls-hint">
        <b>Drag</b> to orbit · <b>Move tool (0)</b> drag-pans without Ctrl · <b>Scroll / pinch</b> zoom ·
        <b>Right-click / Cancel</b> backs out · <b>Space</b> pauses
      </div>
      <div class="modal-footer">
        <button class="btn primary" data-close>${firstRun ? "Start building" : "Got it"}</button>
      </div>
    </div>
  `;
  document.getElementById("hud").appendChild(backdrop);
  const close = () => backdrop.remove();
  backdrop.addEventListener("click", (e) => { if (e.target === backdrop) close(); });
  backdrop.querySelector("[data-close]").addEventListener("click", close);
}
