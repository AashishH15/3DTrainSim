import * as THREE from "three";

const FONT = `"Outfit Variable", "Segoe UI", sans-serif`;

// Canvas-based text sprite. `lock: true` draws a small vector padlock before the text.
export function makeLabel(text, { size = 6, color = "#ffffff", bg = "rgba(12,17,25,0.92)", lock = false, surgeTag = "", measureSurgeTag = "" } = {}) {
  // 2x Supersampling factor for razor-sharp vector text on all monitor resolutions
  const scaleFactor = 2;
  const pad = 24 * scaleFactor;
  const fontPx = 80 * scaleFactor; // 160px high resolution font canvas
  const lockW = lock ? fontPx * 0.85 : 0;
  const fullText = surgeTag ? `${text} · ${surgeTag}` : text;
  const measureText = measureSurgeTag ? fullText.replace(surgeTag, measureSurgeTag) : fullText;
  const isLost = surgeTag.includes("LOST");
  const isSurge = Boolean(surgeTag);

  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  ctx.font = `700 ${fontPx}px ${FONT}`;
  const textW = Math.ceil(ctx.measureText(measureText).width);
  const w = textW + lockW + pad * 2;
  const h = fontPx + pad * 1.5;
  canvas.width = w;
  canvas.height = h;

  const c2 = canvas.getContext("2d");
  c2.imageSmoothingEnabled = true;
  c2.imageSmoothingQuality = "high";

  // Draw high-contrast card background
  c2.fillStyle = isSurge ? (isLost ? "rgba(220,38,38,0.95)" : "rgba(234,88,12,0.95)") : bg;
  const r = h / 2;
  c2.beginPath();
  c2.roundRect(0, 0, w, h, r);
  c2.fill();

  // Subtle crisp border outline for high contrast pop against land terrain
  c2.strokeStyle = isSurge ? (isLost ? "#fca5a5" : "#fdba74") : "rgba(255,255,255,0.25)";
  c2.lineWidth = Math.max(3, 4 * scaleFactor);
  c2.stroke();

  if (lock) {
    const cx = pad + lockW * 0.38;
    const cy = h / 2;
    const bw = fontPx * 0.52;
    const bh = fontPx * 0.42;
    c2.strokeStyle = "#ffffff";
    c2.lineWidth = fontPx * 0.11;
    // shackle
    c2.beginPath();
    c2.arc(cx, cy - bh * 0.32, bw * 0.32, Math.PI, 0);
    c2.stroke();
    // body
    c2.fillStyle = "#ffffff";
    c2.beginPath();
    c2.roundRect(cx - bw / 2, cy - bh * 0.32, bw, bh, bw * 0.16);
    c2.fill();
  }

  // Text shadow for extra high-contrast pop on any background
  c2.shadowColor = "rgba(0,0,0,0.75)";
  c2.shadowBlur = 5 * scaleFactor;
  c2.shadowOffsetX = 0;
  c2.shadowOffsetY = 2 * scaleFactor;

  c2.font = `700 ${fontPx}px ${FONT}`;
  c2.fillStyle = color;
  c2.textAlign = "left";
  c2.textBaseline = "middle";
  c2.fillText(fullText, pad + lockW, h / 2 + 3 * scaleFactor);

  const tex = new THREE.CanvasTexture(canvas);
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.anisotropy = 16;
  tex.generateMipmaps = true;

  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true }));
  const aspect = w / h;
  sprite.scale.set(size * aspect * 0.28, size * 0.28, 1);
  sprite.renderOrder = 10;
  return sprite;
}
