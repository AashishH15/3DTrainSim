import * as THREE from "three";
import {
  fmtMoney,
  fmtInt,
  fmtSimDuration,
  getGameMode,
  isSurvivalMode,
} from "../core/config.js";
import { displaySimTime } from "../sim/simulation.js";
import { isOfficialRun } from "../core/integrity.js";
import { USA_METROS } from "../data/usaMetros.js";
import { NYC_EXTENT } from "../data/nycMap.js";
import { projectLonLat, projectMetro } from "../render/usaProjection.js";
import { icon } from "./icons.js";

const FONT = '"Outfit Variable", "Segoe UI", sans-serif';
const CARD_W = 1200;
const STATS_H = 248;
const CAPTURE_SCALE = 2;
const SITE_URL = "https://overlandgame.netlify.app/";

function mapLabel(mapKey) {
  return mapKey === "nyc" ? "New York City" : "USA National";
}

/** Contiguous US only — metro footprint (+ pad). Excludes Alaska/Hawaii land. */
function conusShareBounds() {
  const box = new THREE.Box3();
  for (const m of USA_METROS) {
    const [x, z] = projectMetro(m);
    box.expandByPoint(new THREE.Vector3(x, 0, z));
  }
  for (const [lon, lat] of [[-124, 49], [-124, 48.5], [-117, 32.5], [-81, 25], [-70, 43]]) {
    const p = projectLonLat(lon, lat);
    if (p) box.expandByPoint(new THREE.Vector3(p[0], 0, p[1]));
  }
  const padX = 12;
  const padSouth = 12;
  const padNorth = 26; // Seattle + label pills need extra room at the top
  return {
    minX: box.min.x - padX,
    maxX: box.max.x + padX,
    minZ: box.min.z - padNorth,
    maxZ: box.max.z + padSouth,
  };
}

function fullMapBounds(mapKey) {
  if (mapKey === "nyc") {
    const e = NYC_EXTENT;
    return { minX: -e, maxX: e, minZ: -e, maxZ: e };
  }
  return conusShareBounds();
}

function isAkHiInset(cx, cz) {
  // Albers inset positions — not part of the playable CONUS map.
  if (cx > -105 && cx < -72 && cz > 22 && cz < 48) return true;
  if (cx > -58 && cx < -38 && cz > 36 && cz < 50) return true;
  return false;
}

function hideTerrainOutsideBounds(scene, bounds) {
  const toggled = [];
  scene.traverse((o) => {
    if (!o.isMesh || o.userData.isWater) return;
    const box = new THREE.Box3().setFromObject(o);
    if (box.isEmpty()) return;
    const cx = (box.min.x + box.max.x) / 2;
    const cz = (box.min.z + box.max.z) / 2;
    if (isAkHiInset(cx, cz)) {
      toggled.push([o, o.visible]);
      o.visible = false;
      return;
    }
    if (cx >= bounds.minX && cx <= bounds.maxX && cz >= bounds.minZ && cz <= bounds.maxZ) return;
    toggled.push([o, o.visible]);
    o.visible = false;
  });
  return toggled;
}

function restoreVisibility(toggled) {
  for (const [o, visible] of toggled) o.visible = visible;
}

function shareMapNodes(ms, mapKey, bounds) {
  const nodes = Object.values(ms.nodes);
  if (mapKey === "nyc") return nodes;
  return nodes.filter(
    (n) => n.x >= bounds.minX && n.x <= bounds.maxX && n.z >= bounds.minZ && n.z <= bounds.maxZ,
  );
}

/** Map band matches bounds aspect exactly so the map fills the card width. */
function shareLayout(mapKey) {
  const bounds = fullMapBounds(mapKey);
  const aspect = (bounds.maxX - bounds.minX) / (bounds.maxZ - bounds.minZ);
  const mapH = Math.round(CARD_W / aspect);
  return {
    bounds,
    mapW: CARD_W,
    mapH,
    cardH: mapH + STATS_H,
    aspect,
  };
}

function setMapLabelsVisible(game, mapKey, visible) {
  for (const entry of Object.values(game.renderers[mapKey].nodes.meshes)) {
    entry.group.traverse((o) => {
      if (o instanceof THREE.Sprite) o.visible = visible;
    });
  }
}

function worldToPixel(x, z, cam, w, h) {
  const v = new THREE.Vector3(x, 0, z);
  v.project(cam);
  return {
    x: (v.x * 0.5 + 0.5) * w,
    y: (1 - (v.y * 0.5 + 0.5)) * h,
  };
}

function drawCityLabels(ctx, nodes, cam, w, h, mapKey) {
  const fontPx = (mapKey === "nyc" ? 13 : 11) * CAPTURE_SCALE;
  const padX = 6 * CAPTURE_SCALE;
  const padY = 3 * CAPTURE_SCALE;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  for (const node of nodes) {
    const { x, y } = worldToPixel(node.x, node.z, cam, w, h);
    if (x < fontPx || x > w - fontPx || y < fontPx || y > h - fontPx) continue;
    const text = node.name;
    ctx.font = `600 ${fontPx}px ${FONT}`;
    const tw = ctx.measureText(text).width + padX * 2;
    const th = fontPx + padY * 2;
    const margin = th * 1.2;
    const above = y > margin;
    const offset = 10 * CAPTURE_SCALE;
    const pillY = above ? y - offset : y + offset;
    ctx.fillStyle = "rgba(20, 26, 36, 0.84)";
    ctx.beginPath();
    ctx.roundRect(x - tw / 2, pillY - th / 2, tw, th, th / 2);
    ctx.fill();
    ctx.fillStyle = node.station ? "#ffffff" : node.unlocked ? "#d8e0ea" : "#aab4c2";
    ctx.fillText(text, x, pillY);
  }
}

/** Top-down ortho view; needs explicit up vector (default up breaks when looking straight down). */
function aimTopDown(cam, cx, cz) {
  cam.position.set(cx, 500, cz);
  cam.up.set(0, 0, -1);
  cam.lookAt(cx, 0, cz);
}

function fitOrthoCamera(cam, bounds) {
  const cx = (bounds.minX + bounds.maxX) / 2;
  const cz = (bounds.minZ + bounds.maxZ) / 2;
  const halfW = (bounds.maxX - bounds.minX) / 2;
  const halfH = (bounds.maxZ - bounds.minZ) / 2;

  cam.left = cx - halfW;
  cam.right = cx + halfW;
  cam.top = cz + halfH;
  cam.bottom = cz - halfH;
  aimTopDown(cam, cx, cz);
  cam.updateProjectionMatrix();
}

function renderTargetToCanvas(renderer, target, w, h) {
  const pixels = new Uint8Array(w * h * 4);
  renderer.readRenderTargetPixels(target, 0, 0, w, h, pixels);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  const imageData = ctx.createImageData(w, h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const src = ((h - 1 - y) * w + x) * 4;
      const dst = (y * w + x) * 4;
      imageData.data[dst] = pixels[src];
      imageData.data[dst + 1] = pixels[src + 1];
      imageData.data[dst + 2] = pixels[src + 2];
      imageData.data[dst + 3] = pixels[src + 3];
    }
  }
  ctx.putImageData(imageData, 0, 0);
  return canvas;
}

/** Render a top-down snapshot of the full map for share cards. */
export function captureNetworkSnapshot(game, mapKey = game.state.currentMap) {
  const layout = shareLayout(mapKey);
  const bundle = game.bundles[mapKey];
  const ms = game.state.maps[mapKey];
  const renderer = game.renderer;
  const captureW = layout.mapW * CAPTURE_SCALE;
  const captureH = layout.mapH * CAPTURE_SCALE;
  const snapCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.5, 2000);

  const savedPreview = bundle.previewGroup.visible;
  bundle.previewGroup.visible = false;

  const scene = bundle.scene;
  const savedFog = scene.fog;
  scene.fog = null;

  const hidden = mapKey === "usa" ? hideTerrainOutsideBounds(scene, layout.bounds) : [];
  fitOrthoCamera(snapCam, layout.bounds);
  setMapLabelsVisible(game, mapKey, false);

  game.renderers[mapKey].trains.update();
  game.renderers[mapKey].nodes.update();

  const target = new THREE.WebGLRenderTarget(captureW, captureH);
  const prevTarget = renderer.getRenderTarget();
  renderer.setRenderTarget(target);
  renderer.render(scene, snapCam);
  renderer.setRenderTarget(prevTarget);

  const canvas = renderTargetToCanvas(renderer, target, captureW, captureH);
  target.dispose();
  drawCityLabels(
    canvas.getContext("2d"),
    shareMapNodes(ms, mapKey, layout.bounds),
    snapCam,
    captureW,
    captureH,
    mapKey,
  );

  scene.fog = savedFog;
  bundle.previewGroup.visible = savedPreview;
  setMapLabelsVisible(game, mapKey, true);
  restoreVisibility(hidden);

  return { dataUrl: canvas.toDataURL("image/png"), layout };
}

export function buildShareStatsFromRecord(record) {
  const timeSec = record.survival ? record.survivalTime : record.simTime;
  return {
    headline: record.officialRun ? record.headline : "Unofficial run",
    modeName: record.modeName,
    mapName: mapLabel(record.mapKey),
    official: record.officialRun,
    timeLabel: record.survival ? "Survived" : "Time elapsed",
    time: fmtSimDuration(timeSec),
    trains: fmtInt(record.trainCount),
    passengers: fmtInt(record.totalDelivered),
    cash: fmtMoney(record.cash),
    earned: fmtMoney(record.totalRevenue),
    survival: record.survival,
  };
}

export function buildShareStats(game, { headline = null, elapsedSec = null } = {}) {
  const s = game.state;
  const survival = isSurvivalMode(s);
  const mode = getGameMode(s);
  const mapKey = s.currentMap;
  const timeSec = elapsedSec ?? (survival && s.gameOver ? (s.survivalTime || displaySimTime(s)) : displaySimTime(s));
  const official = isOfficialRun(s);
  const defaultHeadline = survival ? "Survival run" : "Tycoon run";

  return {
    headline: official ? (headline ?? defaultHeadline) : "Unofficial run",
    modeName: mode.name,
    mapName: mapLabel(mapKey),
    official,
    timeLabel: survival ? "Survived" : "Time elapsed",
    time: fmtSimDuration(timeSec),
    trains: fmtInt(Object.keys(s.trains).length),
    passengers: fmtInt(s.totalDelivered),
    cash: fmtMoney(s.cash),
    earned: fmtMoney(s.totalRevenue),
    survival,
  };
}

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

export async function buildStatsOnlyShareCard(stats) {
  const mapW = CARD_W;
  const mapH = Math.round(CARD_W * 0.35);
  const cardH = mapH + STATS_H;
  const layout = { mapW, mapH, cardH };
  const canvas = document.createElement("canvas");
  canvas.width = mapW;
  canvas.height = cardH;
  const ctx = canvas.getContext("2d");

  const grad = ctx.createLinearGradient(0, 0, mapW, mapH);
  grad.addColorStop(0, "#1a2433");
  grad.addColorStop(1, "#10151d");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, mapW, mapH);

  ctx.fillStyle = "rgba(42, 109, 181, 0.15)";
  ctx.font = `700 ${48 * CAPTURE_SCALE / 2}px ${FONT}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("Overland", mapW / 2, mapH / 2 - 20);
  ctx.fillStyle = "#6b7788";
  ctx.font = `600 ${22 * CAPTURE_SCALE / 2}px ${FONT}`;
  ctx.fillText(stats.mapName, mapW / 2, mapH / 2 + 28);

  const panelY = mapH;
  ctx.fillStyle = "#1a212c";
  ctx.fillRect(0, panelY, mapW, cardH - panelY);
  ctx.fillStyle = "#2a6db5";
  ctx.fillRect(0, panelY, mapW, 4);

  ctx.textBaseline = "top";
  ctx.textAlign = "left";
  ctx.fillStyle = "#edf1f6";
  ctx.font = `700 34px ${FONT}`;
  ctx.fillText("Overland", 36, panelY + 24);

  ctx.fillStyle = "#97a3b4";
  ctx.font = `600 22px ${FONT}`;
  const modeLine = stats.official
    ? `${stats.headline} · ${stats.modeName}`
    : `${stats.headline} · ${stats.modeName} · edited stats`;
  ctx.fillText(modeLine, 36, panelY + 68);

  ctx.fillStyle = "#6b7788";
  ctx.font = `500 18px ${FONT}`;
  ctx.fillText(stats.mapName, 36, panelY + 98);

  const statY = panelY + 138;
  const cols = [
    { label: stats.timeLabel, value: stats.time },
    { label: "Trains", value: stats.trains },
    { label: "Passengers", value: stats.passengers },
    { label: "Cash", value: stats.cash },
    { label: "Total earned", value: stats.earned },
  ];
  const colW = (mapW - 72) / cols.length;
  cols.forEach((col, i) => {
    const x = 36 + i * colW;
    ctx.fillStyle = "#6b7788";
    ctx.font = `600 14px ${FONT}`;
    ctx.fillText(col.label.toUpperCase(), x, statY);
    ctx.fillStyle = "#edf1f6";
    ctx.font = `700 26px ${FONT}`;
    ctx.fillText(col.value, x, statY + 22);
  });

  ctx.fillStyle = "#6b7788";
  ctx.font = `500 16px ${FONT}`;
  ctx.textAlign = "right";
  ctx.fillText(SITE_URL.replace("https://", ""), mapW - 36, cardH - 28);
  ctx.textAlign = "left";

  return { canvas, layout };
}

export async function buildShareCardCanvas(mapDataUrl, stats, layout) {
  const { mapW, mapH, cardH } = layout;
  const canvas = document.createElement("canvas");
  canvas.width = mapW;
  canvas.height = cardH;
  const ctx = canvas.getContext("2d");

  ctx.fillStyle = "#10151d";
  ctx.fillRect(0, 0, mapW, cardH);

  const mapImg = await loadImage(mapDataUrl);
  ctx.drawImage(mapImg, 0, 0, mapW, mapH);

  const panelY = mapH;
  const grad = ctx.createLinearGradient(0, panelY - 40, 0, panelY + 40);
  grad.addColorStop(0, "rgba(16, 21, 29, 0)");
  grad.addColorStop(1, "rgba(16, 21, 29, 0.95)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, panelY - 40, mapW, 40);

  ctx.fillStyle = "#1a212c";
  ctx.fillRect(0, panelY, mapW, cardH - panelY);

  ctx.fillStyle = "#2a6db5";
  ctx.fillRect(0, panelY, mapW, 4);

  ctx.textBaseline = "top";
  ctx.fillStyle = "#edf1f6";
  ctx.font = `700 34px ${FONT}`;
  ctx.fillText("Overland", 36, panelY + 24);

  ctx.fillStyle = "#97a3b4";
  ctx.font = `600 22px ${FONT}`;
  const modeLine = stats.official
    ? `${stats.headline} · ${stats.modeName}`
    : `${stats.headline} · ${stats.modeName} · edited stats`;
  ctx.fillText(modeLine, 36, panelY + 68);

  ctx.fillStyle = "#6b7788";
  ctx.font = `500 18px ${FONT}`;
  ctx.fillText(stats.mapName, 36, panelY + 98);

  const statY = panelY + 138;
  const cols = [
    { label: stats.timeLabel, value: stats.time },
    { label: "Trains", value: stats.trains },
    { label: "Passengers", value: stats.passengers },
    { label: "Cash", value: stats.cash },
    { label: "Total earned", value: stats.earned },
  ];
  const colW = (mapW - 72) / cols.length;
  cols.forEach((col, i) => {
    const x = 36 + i * colW;
    ctx.fillStyle = "#6b7788";
    ctx.font = `600 14px ${FONT}`;
    ctx.fillText(col.label.toUpperCase(), x, statY);
    ctx.fillStyle = "#edf1f6";
    ctx.font = `700 26px ${FONT}`;
    ctx.fillText(col.value, x, statY + 22);
  });

  ctx.fillStyle = "#6b7788";
  ctx.font = `500 16px ${FONT}`;
  ctx.textAlign = "right";
  ctx.fillText(SITE_URL.replace("https://", ""), mapW - 36, cardH - 28);
  ctx.textAlign = "left";

  return canvas;
}

function shareSummary(stats) {
  return [
    `${stats.headline} · ${stats.modeName}`,
    `${stats.timeLabel} ${stats.time}`,
    `${stats.trains} trains · ${stats.passengers} passengers`,
    `${stats.cash} cash · ${stats.earned} earned`,
    `Built in Overland — ${SITE_URL}`,
  ].join("\n");
}

async function canvasToBlob(canvas) {
  return new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
}

async function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

async function shareImage(blob, stats) {
  const file = new File([blob], "overland-run.png", { type: "image/png" });
  const text = shareSummary(stats);
  if (navigator.share) {
    const payload = { title: "Overland", text, url: SITE_URL };
    if (navigator.canShare?.({ files: [file] })) payload.files = [file];
    try {
      await navigator.share(payload);
      return "shared";
    } catch (e) {
      if (e?.name === "AbortError") return "cancelled";
    }
  }
  await downloadBlob(blob, "3dtrainsim-run.png");
  return "downloaded";
}

function shareButton(label, primary = false) {
  return `<button class="btn ${primary ? "primary" : ""}" type="button" data-share-act="${label.toLowerCase().replace(/\s+/g, "-")}">${label}</button>`;
}

/** Share modal for a saved run record (stats card, no live map snapshot). */
export async function openShareModalFromRecord(game, record) {
  if (document.getElementById("share-modal-backdrop")) return;

  const backdrop = document.createElement("div");
  backdrop.className = "modal-backdrop";
  backdrop.id = "share-modal-backdrop";
  backdrop.innerHTML = `
    <div class="modal share-modal">
      <h2>${icon("share")} Share your run</h2>
      <div class="sub">Past run from <b>${mapLabel(record.mapKey)}</b> · ${record.outcomeLabel}</div>
      <div class="share-preview-wrap">
        <div class="share-loading">Building share card…</div>
      </div>
      <div class="modal-footer share-footer" hidden>
        ${shareButton("Share image", true)}
        ${shareButton("Download PNG")}
        ${shareButton("Copy stats")}
        <button class="btn quiet" type="button" data-share-act="close">Close</button>
      </div>
    </div>
  `;
  document.getElementById("hud").appendChild(backdrop);

  const wrap = backdrop.querySelector(".share-preview-wrap");
  const footer = backdrop.querySelector(".share-footer");
  const close = () => backdrop.remove();
  backdrop.addEventListener("click", (e) => { if (e.target === backdrop) close(); });
  backdrop.querySelector('[data-share-act="close"]')?.addEventListener("click", close);

  let cardCanvas = null;
  let stats = null;

  try {
    stats = buildShareStatsFromRecord(record);
    const built = await buildStatsOnlyShareCard(stats);
    cardCanvas = built.canvas;
    wrap.innerHTML = `<img class="share-preview" alt="Share preview" src="${cardCanvas.toDataURL("image/png")}" />`;
    footer.hidden = false;
  } catch (e) {
    wrap.innerHTML = `<div class="share-loading share-error">Could not build share card. Try again.</div>`;
    console.warn("share card from record failed", e);
    return;
  }

  backdrop.querySelector('[data-share-act="share-image"]')?.addEventListener("click", async () => {
    const blob = await canvasToBlob(cardCanvas);
    const result = await shareImage(blob, stats);
    if (result === "shared") game.hud.toast("Shared!", "good");
    else if (result === "downloaded") game.hud.toast("Image downloaded", "good");
  });

  backdrop.querySelector('[data-share-act="download-png"]')?.addEventListener("click", async () => {
    const blob = await canvasToBlob(cardCanvas);
    await downloadBlob(blob, "overland-run.png");
    game.hud.toast("Image downloaded", "good");
  });

  backdrop.querySelector('[data-share-act="copy-stats"]')?.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(shareSummary(stats));
      game.hud.toast("Stats copied", "good");
    } catch {
      game.hud.toast("Could not copy stats", "bad");
    }
  });
}

/** Open share preview modal; generates card from current map + stats. */
export async function openShareModal(game, opts = {}) {
  if (document.getElementById("share-modal-backdrop")) return;

  const backdrop = document.createElement("div");
  backdrop.className = "modal-backdrop";
  backdrop.id = "share-modal-backdrop";
  backdrop.innerHTML = `
    <div class="modal share-modal">
      <h2>${icon("share")} Share your run</h2>
      <div class="sub">Generating a full <b>${mapLabel(game.state.currentMap)}</b> map snapshot with your run stats.</div>
      <div class="share-preview-wrap">
        <div class="share-loading">Building share card…</div>
      </div>
      <div class="modal-footer share-footer" hidden>
        ${shareButton("Share image", true)}
        ${shareButton("Download PNG")}
        ${shareButton("Copy stats")}
        <button class="btn quiet" type="button" data-share-act="close">Close</button>
      </div>
    </div>
  `;
  document.getElementById("hud").appendChild(backdrop);

  const wrap = backdrop.querySelector(".share-preview-wrap");
  const footer = backdrop.querySelector(".share-footer");
  const close = () => backdrop.remove();
  backdrop.addEventListener("click", (e) => { if (e.target === backdrop) close(); });
  backdrop.querySelector('[data-share-act="close"]')?.addEventListener("click", close);

  let cardCanvas = null;
  let stats = null;

  try {
    const mapKey = game.state.currentMap;
    const { dataUrl, layout } = captureNetworkSnapshot(game, mapKey);
    stats = buildShareStats(game, opts);
    cardCanvas = await buildShareCardCanvas(dataUrl, stats, layout);
    wrap.innerHTML = `<img class="share-preview" alt="Share preview" src="${cardCanvas.toDataURL("image/png")}" />`;
    footer.hidden = false;
  } catch (e) {
    wrap.innerHTML = `<div class="share-loading share-error">Could not build share card. Try again.</div>`;
    console.warn("share card failed", e);
    return;
  }

  backdrop.querySelector('[data-share-act="share-image"]')?.addEventListener("click", async () => {
    const blob = await canvasToBlob(cardCanvas);
    const result = await shareImage(blob, stats);
    if (result === "shared") game.hud.toast("Shared!", "good");
    else if (result === "downloaded") game.hud.toast("Image downloaded", "good");
  });

  backdrop.querySelector('[data-share-act="download-png"]')?.addEventListener("click", async () => {
    const blob = await canvasToBlob(cardCanvas);
    await downloadBlob(blob, "overland-run.png");
    game.hud.toast("Image downloaded", "good");
  });

  backdrop.querySelector('[data-share-act="copy-stats"]')?.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(shareSummary(stats));
      game.hud.toast("Stats copied", "good");
    } catch {
      game.hud.toast("Could not copy stats", "bad");
    }
  });
}

/** Compact share button markup for end-of-run modals. */
export function shareModalActions(primary = false) {
  return `<button class="btn ${primary ? "primary" : ""}" type="button" data-share>${icon("share")} Share run</button>`;
}

export function bindShareAction(backdrop, game, opts = {}) {
  backdrop.querySelector("[data-share]")?.addEventListener("click", () => openShareModal(game, opts));
}
