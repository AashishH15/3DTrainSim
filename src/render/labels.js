import * as THREE from "three";

// Canvas-based text sprite.
export function makeLabel(text, { size = 6, color = "#eef2f7", bg = "rgba(20,26,36,0.72)" } = {}) {
  const pad = 14;
  const fontPx = 42;
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  ctx.font = `700 ${fontPx}px "Segoe UI", sans-serif`;
  const w = Math.ceil(ctx.measureText(text).width) + pad * 2;
  const h = fontPx + pad * 1.4;
  canvas.width = w;
  canvas.height = h;

  const c2 = canvas.getContext("2d");
  c2.font = `700 ${fontPx}px "Segoe UI", sans-serif`;
  c2.fillStyle = bg;
  const r = h / 2;
  c2.beginPath();
  c2.roundRect(0, 0, w, h, r);
  c2.fill();
  c2.fillStyle = color;
  c2.textAlign = "center";
  c2.textBaseline = "middle";
  c2.fillText(text, w / 2, h / 2 + 2);

  const tex = new THREE.CanvasTexture(canvas);
  tex.anisotropy = 4;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true }));
  const aspect = w / h;
  sprite.scale.set(size * aspect * 0.28, size * 0.28, 1);
  sprite.renderOrder = 10;
  return sprite;
}
