import { fmtMoney } from "../core/config.js";
import { calculateBondTaxRate } from "../core/economy.js";
import { icon } from "./icons.js";

export function openBondModal(game) {
  // Prevent duplicate modals
  if (document.getElementById("bond-modal-backdrop")) return;

  const backdrop = document.createElement("div");
  backdrop.className = "modal-backdrop";
  backdrop.id = "bond-modal-backdrop";

  backdrop.innerHTML = `
    <div class="modal" style="width: min(32rem, 94vw); text-align: center;">
      <h2>${icon("coins")} Issue Transit Bond</h2>
      <div class="sub" style="margin-bottom: 1.5rem;">Raise emergency cash to save your network. Repay in 10 simulation minutes.</div>
      
      <div style="margin: 1.5rem 0; padding: 1.2rem; background: rgba(0,0,0,0.25); border-radius: 6px; border: 1px solid rgba(255,255,255,0.05);">
        <div style="font-size: 0.85rem; color: #8a96a6; text-transform: uppercase; font-weight: bold; letter-spacing: 0.05em; margin-bottom: 0.4rem;">Bond Size</div>
        <div id="bond-val" style="font-size: 2.2rem; font-weight: bold; color: var(--accent); font-family: monospace;">$1,000,000</div>
        
        <input type="range" id="bond-slider" min="500000" max="5000000" step="500000" value="1000000" 
          style="width: 100%; margin: 1.2rem 0 0.8rem 0; accent-color: var(--accent); cursor: pointer;" />
          
        <div style="display: flex; justify-content: space-between; font-size: 0.75rem; color: #6b7788; font-family: monospace; font-weight: bold; margin-bottom: 1rem;">
          <span>$500K</span>
          <span>$5.0M</span>
        </div>
        
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.8rem; margin-top: 1rem; border-top: 1px dashed rgba(255,255,255,0.08); padding-top: 1rem; text-align: left;">
          <div>
            <div style="font-size: 0.75rem; color: #8a96a6;">Revenue Tax Rate</div>
            <div id="bond-tax" style="font-size: 1.25rem; font-weight: bold; color: var(--good); font-family: monospace;">18%</div>
          </div>
          <div>
            <div style="font-size: 0.75rem; color: #8a96a6;">Repayment Term</div>
            <div style="font-size: 1.25rem; font-weight: bold; color: #ffffff;">10 minutes</div>
          </div>
        </div>
      </div>

      <div id="bond-warning" style="font-size: 0.84rem; color: #ff5555; background: rgba(255, 85, 85, 0.08); padding: 0.65rem 0.8rem; border-radius: 4px; border: 1px solid rgba(255, 85, 85, 0.2); margin-bottom: 1.5rem; line-height: 1.4;">
        ⚠️ Taxing 18% of all ticket sales. You must have $1.0M cash at the deadline, or suffer a default Strike (+1 Strike).
      </div>

      <div style="display: flex; gap: 0.6rem; justify-content: flex-end;">
        <button class="btn quiet" id="bond-cancel">Cancel</button>
        <button class="btn primary" id="bond-confirm">Issue Bond</button>
      </div>
    </div>
  `;

  document.getElementById("hud").appendChild(backdrop);

  const slider = backdrop.querySelector("#bond-slider");
  const valEl = backdrop.querySelector("#bond-val");
  const taxEl = backdrop.querySelector("#bond-tax");
  const warnEl = backdrop.querySelector("#bond-warning");

  function update() {
    const val = parseInt(slider.value, 10);
    const taxRate = calculateBondTaxRate(val);
    const taxPct = Math.round(taxRate * 100);
    valEl.textContent = fmtMoney(val);
    taxEl.textContent = `${taxPct}%`;
    warnEl.innerHTML = `⚠️ Taxing <b>${taxPct}%</b> of all ticket sales. You must have <b>${fmtMoney(val)}</b> cash at the deadline, or suffer a default Strike (+1 Strike).`;
  }

  slider.addEventListener("input", update);
  update(); // Initial setup

  backdrop.querySelector("#bond-cancel").addEventListener("click", () => {
    backdrop.remove();
  });

  backdrop.querySelector("#bond-confirm").addEventListener("click", () => {
    const val = parseInt(slider.value, 10);
    const taxRate = calculateBondTaxRate(val);
    game.issueBond(val, taxRate);
    backdrop.remove();
  });
}
