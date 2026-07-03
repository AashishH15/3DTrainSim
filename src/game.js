import * as THREE from "three";
import { TIERS, TRACK_TYPES, ECON, fmtMoney } from "./core/config.js";
import { freshState, loadState, saveState, clearSave, makeEdge, removeEdge } from "./core/state.js";
import { edgeKey, nodeDist } from "./core/graph.js";
import { trackCost, stationCost, nodeUnlockCost, upgradeCost, bulldozeRefund } from "./core/economy.js";
import { stepSimulation, assignRoute, revalidateTrains } from "./sim/simulation.js";
import { waterFraction } from "./data/nycMap.js";
import { createRenderer, createSceneBundle, tickWater } from "./render/scene.js";
import { buildUsaTerrain } from "./render/usaMap.js";
import { buildNycTerrain } from "./render/nycMap.js";
import { NodesRenderer } from "./render/nodesRenderer.js";
import { TrackRenderer } from "./render/trackRenderer.js";
import { TrainRenderer } from "./render/trainRenderer.js";
import { MAP_RENDER } from "./render/constants.js";
import { Hud } from "./ui/hud.js";
import { Inspector } from "./ui/inspector.js";
import { openShop as openShopModal, openGameOver } from "./ui/shop.js";
import { on, emit } from "./core/bus.js";

export class Game {
  constructor() {
    this.state = loadState() ?? freshState();
    this.mode = "select";
    this.trackStart = null;      // nodeId while drawing track
    this.routeDraft = null;      // { trainId, stops: [] }
    this.hoverPoint = null;
    this.hoverObject = null;

    this.renderer = createRenderer();
    this.bundles = {
      usa: createSceneBundle(this.renderer, {
        background: 0x1a2b3f, fogNear: 400, fogFar: 1200,
        cameraPos: new THREE.Vector3(0, 230, 150), target: new THREE.Vector3(0, 0, -10),
        minDist: 30, maxDist: 520, shadowExtent: 300,
      }),
      nyc: createSceneBundle(this.renderer, {
        background: 0x16232f, fogNear: 250, fogFar: 800,
        cameraPos: new THREE.Vector3(-30, 120, 110), target: new THREE.Vector3(0, 0, 10),
        minDist: 12, maxDist: 330, shadowExtent: 140,
      }),
    };
    buildUsaTerrain(this.bundles.usa.scene);
    buildNycTerrain(this.bundles.nyc.scene);

    this.renderers = {};
    for (const mk of ["usa", "nyc"]) {
      this.renderers[mk] = {
        nodes: new NodesRenderer(mk, this.bundles[mk], this.state),
        track: new TrackRenderer(mk, this.bundles[mk], this.state),
        trains: new TrainRenderer(mk, this.bundles[mk], this.state),
      };
    }

    this.hud = new Hud(this);
    this.inspector = new Inspector(this);
    on("gameOver", () => openGameOver(this));

    this.raycaster = new THREE.Raycaster();
    this.pointer = new THREE.Vector2();
    this.bindInput();

    this.activeBundle.controls.enabled = true;
    this.updateHint();

    // Preview line for track drawing / route highlighting.
    this.previewMat = new THREE.MeshLambertMaterial({ color: 0xffffff, transparent: true, opacity: 0.7 });

    window.addEventListener("resize", () => this.onResize());
    setInterval(() => { if (!this.state.gameOver) saveState(this.state); }, 5000);
    window.addEventListener("beforeunload", () => saveState(this.state));

    // When the tab is hidden, rAF stops; keep the simulation ticking from a
    // (throttled) interval instead so the empire keeps running.
    this.lastHiddenTick = performance.now();
    setInterval(() => {
      const now = performance.now();
      if (document.hidden) {
        const dt = Math.min((now - this.lastHiddenTick) / 1000, 2);
        stepSimulation(this.state, dt);
      }
      this.lastHiddenTick = now;
    }, 500);

    this.clock = new THREE.Clock();
    this.loop();

    if (this.state.gameOver) openGameOver(this);
  }

  get activeBundle() { return this.bundles[this.state.currentMap]; }
  get activeMapState() { return this.state.maps[this.state.currentMap]; }

  // ================= game actions =================

  newGame() {
    clearSave();
    this.state = freshState();
    // Rebind state into renderers.
    for (const mk of ["usa", "nyc"]) {
      const b = this.bundles[mk];
      b.pickables.clear();
      b.trackGroup.clear();
      b.trainGroup.clear();
      b.previewGroup.clear();
      this.renderers[mk] = {
        nodes: new NodesRenderer(mk, b, this.state),
        track: new TrackRenderer(mk, b, this.state),
        trains: new TrainRenderer(mk, b, this.state),
      };
    }
    this.setMode("select");
    this.inspector.close();
    this.hud.renderToolbar();
    emit("toast", { msg: "New empire started. Build stations, lay track, buy trains!", kind: "good" });
  }

  toggleMap() {
    this.switchMap(this.state.currentMap === "usa" ? "nyc" : "usa");
  }

  switchMap(mapKey) {
    if (this.state.currentMap === mapKey) return;
    this.cancelTransient();
    this.inspector.close();
    this.bundles[this.state.currentMap].controls.enabled = false;
    this.state.currentMap = mapKey;
    this.activeBundle.controls.enabled = true;
    this.hud.renderToolbar();
    this.updateHint();
    emit("toast", { msg: mapKey === "usa" ? "National network" : "New York City network" });
  }

  setMode(mode) {
    this.mode = mode;
    this.cancelTransient(false);
    this.hud.syncToolbar();
    this.updateHint();
  }

  cancelTransient(resetMode = true) {
    this.trackStart = null;
    this.routeDraft = null;
    this.clearPreview();
    if (resetMode && this.mode === "route") this.mode = "select";
  }

  spend(amount) {
    if (this.state.cash < amount) {
      emit("toast", { msg: `Not enough cash (need ${fmtMoney(amount)})`, kind: "bad" });
      return false;
    }
    this.state.cash -= amount;
    return true;
  }

  unlockNode(nodeId) {
    const node = this.activeMapState.nodes[nodeId];
    if (!node || node.unlocked) return;
    const cost = nodeUnlockCost(node);
    if (!this.spend(cost)) return;
    node.unlocked = true;
    this.renderers[this.state.currentMap].nodes.rebuildNode(node);
    emit("toast", { msg: `${node.name} unlocked!`, kind: "good" });
    this.inspector.showNode(nodeId);
  }

  buildStation(nodeId) {
    const mapKey = this.state.currentMap;
    const node = this.activeMapState.nodes[nodeId];
    if (!node || node.station) return;
    if (!node.unlocked) {
      // One click: unlock + station together.
      const total = nodeUnlockCost(node) + stationCost(mapKey, node);
      if (!this.spend(total)) return;
      node.unlocked = true;
      node.station = true;
      emit("toast", { msg: `${node.name}: unlocked + station built (${fmtMoney(total)})`, kind: "good" });
    } else {
      const cost = stationCost(mapKey, node);
      if (!this.spend(cost)) return;
      node.station = true;
      emit("toast", { msg: `Station built at ${node.name} (${fmtMoney(cost)})`, kind: "good" });
    }
    this.renderers[mapKey].nodes.rebuildNode(node);
    if (this.inspector.current?.id === nodeId) this.inspector.showNode(nodeId);
  }

  tryBuildTrack(aId, bId, type) {
    const mapKey = this.state.currentMap;
    const ms = this.activeMapState;
    if (aId === bId) return;
    const na = ms.nodes[aId];
    const nb = ms.nodes[bId];
    if (!na?.station || !nb?.station) {
      emit("toast", { msg: "Both endpoints need stations first", kind: "bad" });
      return;
    }
    if (ms.edges[edgeKey(aId, bId)]) {
      emit("toast", { msg: "These stops are already connected", kind: "bad" });
      return;
    }
    const length = nodeDist(na, nb);
    const wf = mapKey === "nyc" ? waterFraction(na.x, na.z, nb.x, nb.z) : 0;
    const cost = trackCost(mapKey, type, length, wf);
    if (!this.spend(cost)) return;
    makeEdge(this.state, mapKey, aId, bId, type);
    this.renderers[mapKey].track.sync();
    revalidateTrains(this.state);
    const bridge = wf > 0.02 ? ` (${Math.round(wf * 100)}% bridge)` : "";
    emit("toast", { msg: `${TRACK_TYPES[type].name} laid — ${fmtMoney(cost)}${bridge}`, kind: "good" });
    // Chain: continue drawing from the new endpoint.
    this.trackStart = bId;
  }

  upgradeEdge(edgeId, newType) {
    const mapKey = this.state.currentMap;
    const edge = this.activeMapState.edges[edgeId];
    if (!edge || newType <= edge.type) return;
    const cost = upgradeCost(mapKey, edge, newType);
    if (!this.spend(cost)) return;
    edge.type = newType;
    this.activeMapState.pathVersion++;
    this.renderers[mapKey].track.sync();
    revalidateTrains(this.state);
    emit("toast", { msg: `Upgraded to ${TRACK_TYPES[newType].name} (${fmtMoney(cost)})`, kind: "good" });
    this.inspector.showEdge(edgeId);
  }

  removeEdgeAction(edgeId) {
    const mapKey = this.state.currentMap;
    const edge = this.activeMapState.edges[edgeId];
    if (!edge) return;
    this.state.cash += bulldozeRefund(mapKey, edge);
    removeEdge(this.state, mapKey, edgeId);
    this.renderers[mapKey].track.sync();
    revalidateTrains(this.state);
    this.inspector.close();
    emit("toast", { msg: "Track demolished" });
  }

  buyTrain(tier) {
    const t = TIERS[tier];
    if (!this.spend(t.price)) return false;
    const id = `t${this.state.nextTrainId}`;
    this.state.trains[id] = {
      id, num: this.state.nextTrainId++,
      map: this.state.currentMap,
      tier,
      route: [], path: null, seg: 0, prog: 0, dwell: 0,
      state: "idle", passengers: [], revenueTotal: 0,
    };
    emit("toast", { msg: `${t.icon} ${t.short} train purchased — now pick its route`, kind: "good" });
    this.startRouteAssign(id);
    return true;
  }

  sellTrain(trainId) {
    const train = this.state.trains[trainId];
    if (!train) return;
    this.state.cash += TIERS[train.tier].price * 0.5;
    delete this.state.trains[trainId];
    this.inspector.close();
    emit("toast", { msg: "Train sold (50% refund)" });
  }

  inspectTrain(trainId) {
    const train = this.state.trains[trainId];
    if (!train) return;
    if (train.map !== this.state.currentMap) this.switchMap(train.map);
    this.inspector.showTrain(trainId);
  }

  // ================= route assignment =================

  startRouteAssign(trainId) {
    const train = this.state.trains[trainId];
    if (!train) return;
    if (train.map !== this.state.currentMap) this.switchMap(train.map);
    this.mode = "route";
    this.routeDraft = { trainId, stops: [] };
    this.hud.syncToolbar();
    this.updateHint();
  }

  routeAddStop(nodeId) {
    const draft = this.routeDraft;
    if (!draft) return;
    const node = this.activeMapState.nodes[nodeId];
    if (!node?.station) {
      emit("toast", { msg: "Routes can only include stops with stations", kind: "bad" });
      return;
    }
    if (draft.stops[draft.stops.length - 1] === nodeId) return;
    draft.stops.push(nodeId);
    this.updateHint();
    this.drawRoutePreview();
  }

  finishRouteAssign() {
    const draft = this.routeDraft;
    if (!draft) return;
    const train = this.state.trains[draft.trainId];
    if (!train || draft.stops.length < 2) {
      emit("toast", { msg: "Pick at least 2 stops", kind: "bad" });
      return;
    }
    const ok = assignRoute(this.state, train, [...draft.stops]);
    if (!ok) {
      const tt = TIERS[train.tier];
      emit("toast", {
        msg: `No ${tt.short}-legal track connects those stops (${tt.minTrack})`,
        kind: "bad",
      });
      return;
    }
    emit("toast", { msg: "Route assigned — all aboard!", kind: "good" });
    this.routeDraft = null;
    this.setMode("select");
  }

  openShop() { openShopModal(this); }

  // ================= input & picking =================

  bindInput() {
    const el = this.renderer.domElement;
    let downPos = null;
    el.addEventListener("pointerdown", (e) => { downPos = [e.clientX, e.clientY]; });
    el.addEventListener("pointerup", (e) => {
      if (!downPos) return;
      const moved = Math.hypot(e.clientX - downPos[0], e.clientY - downPos[1]);
      downPos = null;
      if (moved > 6) return; // it was a camera drag
      if (e.button === 2) { this.onRightClick(); return; }
      this.onClick(e);
    });
    el.addEventListener("pointermove", (e) => this.onPointerMove(e));
    el.addEventListener("contextmenu", (e) => e.preventDefault());
    window.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        if (this.routeDraft) { this.routeDraft = null; this.setMode("select"); }
        else this.setMode("select");
        this.inspector.close();
      }
      if (e.key === "Enter" && this.routeDraft) this.finishRouteAssign();
      if (e.key === " " && !e.target.closest?.("input")) {
        e.preventDefault();
        this.state.speed = this.state.speed === 0 ? 1 : 0;
      }
    });
  }

  pick(e) {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.pointer.set(
      ((e.clientX - rect.left) / rect.width) * 2 - 1,
      -((e.clientY - rect.top) / rect.height) * 2 + 1
    );
    const b = this.activeBundle;
    this.raycaster.setFromCamera(this.pointer, b.camera);
    const hits = this.raycaster.intersectObjects(
      [...b.pickables.children, ...b.trackGroup.children, ...b.trainGroup.children], true
    );
    for (const h of hits) {
      let o = h.object;
      while (o && !o.userData?.kind) o = o.parent;
      if (o?.userData?.kind) return { data: o.userData, point: h.point };
    }
    // Fall back to the track-height plane (for preview lines).
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -MAP_RENDER[this.state.currentMap].trackY);
    const pt = new THREE.Vector3();
    this.raycaster.ray.intersectPlane(plane, pt);
    return { data: null, point: pt };
  }

  onClick(e) {
    const { data } = this.pick(e);
    const mode = this.mode;

    if (mode === "select") {
      if (!data) { this.inspector.close(); return; }
      if (data.kind === "node") this.inspector.showNode(data.id);
      else if (data.kind === "edge") this.inspector.showEdge(data.id);
      else if (data.kind === "train") this.inspector.showTrain(data.id);
      return;
    }

    if (mode === "station") {
      if (data?.kind === "node") this.buildStation(data.id);
      return;
    }

    if (mode.startsWith("track")) {
      const type = +mode.slice(5);
      if (data?.kind !== "node") { return; }
      const node = this.activeMapState.nodes[data.id];
      if (!node.station) {
        emit("toast", { msg: `${node.name} needs a station first`, kind: "bad" });
        return;
      }
      if (this.trackStart === null) {
        this.trackStart = data.id;
        this.updateHint();
      } else {
        this.tryBuildTrack(this.trackStart, data.id, type);
        this.updateHint();
      }
      return;
    }

    if (mode === "bulldoze") {
      if (data?.kind === "edge") this.removeEdgeAction(data.id);
      return;
    }

    if (mode === "route") {
      if (data?.kind === "node") this.routeAddStop(data.id);
      return;
    }
  }

  onRightClick() {
    if (this.trackStart) { this.trackStart = null; this.clearPreview(); this.updateHint(); }
    else if (this.routeDraft) { this.routeDraft = null; this.setMode("select"); }
    else this.setMode("select");
  }

  onPointerMove(e) {
    const { data, point } = this.pick(e);
    this.hoverObject = data;
    this.hoverPoint = point;
    this.renderer.domElement.style.cursor =
      data || this.mode !== "select" ? "pointer" : "default";

    if (this.mode.startsWith("track") && this.trackStart) {
      this.drawTrackPreview(point, data);
    }
  }

  // ================= previews & hints =================

  clearPreview() {
    const g = this.activeBundle.previewGroup;
    g.clear();
  }

  drawTrackPreview(point, hoverData) {
    this.clearPreview();
    const mapKey = this.state.currentMap;
    const ms = this.activeMapState;
    const na = ms.nodes[this.trackStart];
    if (!na) return;
    const type = +this.mode.slice(5);

    let bx = point?.x ?? na.x;
    let bz = point?.z ?? na.z;
    let target = null;
    if (hoverData?.kind === "node") {
      target = ms.nodes[hoverData.id];
      bx = target.x; bz = target.z;
    }

    const len = Math.hypot(bx - na.x, bz - na.z);
    if (len < 0.5) return;
    const wf = mapKey === "nyc" ? waterFraction(na.x, na.z, bx, bz) : 0;
    const cost = trackCost(mapKey, type, len, wf);
    const valid = target && target.station && target.id !== na.id && !ms.edges[edgeKey(na.id, target.id)];

    const y = MAP_RENDER[mapKey].trackY + 0.15;
    const geo = new THREE.BoxGeometry(0.5 * (mapKey === "usa" ? 1.4 : 1), 0.1, len);
    const matColor = valid ? TRACK_TYPES[type].color : (target ? 0xff5555 : 0xffffff);
    const mesh = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({
      color: matColor, transparent: true, opacity: 0.65,
    }));
    mesh.position.set((na.x + bx) / 2, y, (na.z + bz) / 2);
    mesh.rotation.y = Math.atan2(bx - na.x, bz - na.z);
    this.activeBundle.previewGroup.add(mesh);

    const bridge = wf > 0.02 ? ` · ${Math.round(wf * 100)}% over water` : "";
    this.hud.setHint(
      `Laying <b>${TRACK_TYPES[type].name}</b> from <b>${na.name}</b> — <span class="cost">${fmtMoney(cost)}</span>${bridge} · right-click to cancel`
    );
  }

  drawRoutePreview() {
    this.clearPreview();
    const draft = this.routeDraft;
    if (!draft || draft.stops.length === 0) return;
    const ms = this.activeMapState;
    const y = MAP_RENDER[this.state.currentMap].trackY + 0.4;
    const mat = new THREE.MeshLambertMaterial({ color: 0xffd257, transparent: true, opacity: 0.8 });
    for (const id of draft.stops) {
      const n = ms.nodes[id];
      const marker = new THREE.Mesh(new THREE.SphereGeometry(0.8 * MAP_RENDER[this.state.currentMap].nodeScale, 10, 8), mat);
      marker.position.set(n.x, y + 0.6, n.z);
      this.activeBundle.previewGroup.add(marker);
    }
    const loop = draft.stops.length > 1 ? [...draft.stops, draft.stops[0]] : draft.stops;
    for (let i = 0; i < loop.length - 1; i++) {
      const a = ms.nodes[loop[i]];
      const b = ms.nodes[loop[i + 1]];
      const len = Math.hypot(b.x - a.x, b.z - a.z);
      if (len < 0.1) continue;
      const line = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.08, len), mat);
      line.position.set((a.x + b.x) / 2, y, (a.z + b.z) / 2);
      line.rotation.y = Math.atan2(b.x - a.x, b.z - a.z);
      this.activeBundle.previewGroup.add(line);
    }
  }

  updateHint() {
    const mode = this.mode;
    if (mode === "select") {
      this.hud.setHint(`Click any <b>stop</b>, <b>track</b> or <b>train</b> to inspect · drag to orbit, scroll to zoom`);
    } else if (mode === "station") {
      this.hud.setHint(`<b>Station mode:</b> click a stop node to build a station (locked metros unlock + build in one click)`);
    } else if (mode.startsWith("track")) {
      const type = +mode.slice(5);
      if (!this.trackStart) {
        this.hud.setHint(`<b>${TRACK_TYPES[type].name}:</b> click the first station · water crossings cost ×2.6`);
      }
    } else if (mode === "bulldoze") {
      this.hud.setHint(`<b>Bulldoze:</b> click a track segment to demolish (25% refund)`);
    } else if (mode === "route") {
      const n = this.routeDraft?.stops.length ?? 0;
      const train = this.state.trains[this.routeDraft?.trainId];
      const tierName = train ? TIERS[train.tier].short : "";
      this.hud.setHint(
        `<b>Route for ${tierName} train:</b> click stations in order (${n} picked) ·
         <button class="btn small primary" id="hint-done">✓ Done</button>
         <button class="btn small" id="hint-cancel">✕ Cancel</button>`
      );
      document.getElementById("hint-done")?.addEventListener("click", () => this.finishRouteAssign());
      document.getElementById("hint-cancel")?.addEventListener("click", () => {
        this.routeDraft = null;
        this.setMode("select");
      });
    }
  }

  // ================= main loop =================

  onResize() {
    const w = window.innerWidth, h = window.innerHeight;
    this.renderer.setSize(w, h);
    for (const b of Object.values(this.bundles)) {
      b.camera.aspect = w / h;
      b.camera.updateProjectionMatrix();
    }
  }

  loop() {
    requestAnimationFrame(() => this.loop());
    const dt = Math.min(this.clock.getDelta(), 0.1);
    stepSimulation(this.state, dt);

    const mk = this.state.currentMap;
    const r = this.renderers[mk];
    r.trains.update();
    r.nodes.update();
    tickWater(this.bundles[mk].scene, this.clock.elapsedTime);
    this.activeBundle.controls.update();
    this.renderer.render(this.activeBundle.scene, this.activeBundle.camera);
  }
}
