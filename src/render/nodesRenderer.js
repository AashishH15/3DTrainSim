import * as THREE from "three";
import { makeLabel } from "./labels.js";
import { MAP_RENDER } from "./constants.js";
import { USA_METROS, metroColor } from "../data/usaMetros.js";
import { platformCapacity } from "../core/economy.js";
import { zoomScale } from "./viewScale.js";

// Renders stop nodes (locked / unlocked / station) and keeps them in sync.
export class NodesRenderer {
  constructor(mapKey, bundle, state) {
    this.mapKey = mapKey;
    this.bundle = bundle;
    this.state = state;
    this.meshes = {}; // nodeId -> { group, status }
    this.cfg = MAP_RENDER[mapKey];
    this.rebuildAll();
  }

  nodeColor(node) {
    if (this.mapKey === "usa") {
      const metro = USA_METROS.find((m) => m.rank === node.rank);
      return metroColor(metro);
    }
    return 0xff8f5a;
  }

  rebuildAll() {
    for (const node of Object.values(this.state.maps[this.mapKey].nodes)) {
      this.rebuildNode(node);
    }
  }

  tagLabel(sprite) {
    sprite.userData.labelBase = sprite.scale.clone();
    return sprite;
  }

  statusOf(node) {
    return node.station ? "station" : node.unlocked ? "unlocked" : "locked";
  }

  rebuildNode(node) {
    const status = this.statusOf(node);
    const existing = this.meshes[node.id];
    if (existing) {
      if (existing.status === status) return;
      this.bundle.pickables.remove(existing.group);
      existing.group.traverse((o) => { o.geometry?.dispose(); });
    }

    const s = this.cfg.nodeScale;
    const y = this.cfg.landTop;
    const group = new THREE.Group();
    group.position.set(node.x, y, node.z);
    group.userData = { kind: "node", id: node.id, map: this.mapKey };

    const color = this.nodeColor(node);
    const demandR = (0.55 + node.demand * 0.05) * s;

    if (status === "locked") {
      const dot = new THREE.Mesh(
        new THREE.CylinderGeometry(demandR * 0.7, demandR * 0.7, 0.18 * s, 10),
        new THREE.MeshLambertMaterial({ color: 0x6b7684, transparent: true, opacity: 0.75 })
      );
      dot.position.y = 0.09 * s;
      group.add(dot);
      const lock = this.tagLabel(makeLabel(node.name, { size: this.cfg.labelSize * 0.8, color: "#aab4c2", lock: true }));
      lock.position.y = 1.6 * s;
      group.add(lock);
    } else if (status === "unlocked") {
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(demandR, 0.1 * s, 6, 20),
        new THREE.MeshLambertMaterial({ color })
      );
      ring.rotation.x = Math.PI / 2;
      ring.position.y = 0.12 * s;
      group.add(ring);
      const dot = new THREE.Mesh(
        new THREE.CylinderGeometry(demandR * 0.45, demandR * 0.45, 0.14 * s, 10),
        new THREE.MeshLambertMaterial({ color, transparent: true, opacity: 0.5 })
      );
      dot.position.y = 0.07 * s;
      group.add(dot);
      const label = this.tagLabel(makeLabel(node.name, { size: this.cfg.labelSize * 0.85, color: "#dfe6ee" }));
      label.position.y = 1.7 * s;
      group.add(label);
    } else {
      // Full station: platform disc + tiny depot + colored ring.
      let stationRing = null;
      const base = new THREE.Mesh(
        new THREE.CylinderGeometry(demandR, demandR * 1.12, 0.3 * s, 12),
        new THREE.MeshLambertMaterial({ color: 0xf2f5f8 })
      );
      base.position.y = 0.15 * s;
      base.castShadow = true;
      group.add(base);
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(demandR, 0.12 * s, 6, 20),
        new THREE.MeshLambertMaterial({ color })
      );
      ring.rotation.x = Math.PI / 2;
      ring.position.y = 0.3 * s;
      ring.userData.baseColor = color;
      group.add(ring);
      stationRing = ring;
      const depot = new THREE.Mesh(
        new THREE.BoxGeometry(0.8 * s, 0.5 * s, 0.55 * s),
        new THREE.MeshLambertMaterial({ color })
      );
      depot.position.set(demandR * 0.75, 0.55 * s, -demandR * 0.75);
      depot.castShadow = true;
      group.add(depot);
      const roof = new THREE.Mesh(
        new THREE.ConeGeometry(0.55 * s, 0.4 * s, 4),
        new THREE.MeshLambertMaterial({ color: 0x3a4556 })
      );
      roof.rotation.y = Math.PI / 4;
      roof.position.set(demandR * 0.75, 0.98 * s, -demandR * 0.75);
      group.add(roof);
      const label = this.tagLabel(makeLabel(node.name, { size: this.cfg.labelSize, color: "#ffffff" }));
      label.position.y = 2.0 * s;
      group.add(label);

      // Waiting-passenger indicator (updated per frame).
      const wait = new THREE.Mesh(
        new THREE.BoxGeometry(0.3 * s, 1, 0.3 * s),
        new THREE.MeshLambertMaterial({ color: 0xffd257 })
      );
      wait.position.set(-demandR * 0.9, 0, demandR * 0.9);
      wait.visible = false;
      group.add(wait);
      group.userData.waitBar = wait;

      const pick = new THREE.Mesh(
        new THREE.CylinderGeometry(Math.max(demandR * 1.6, 1.6 * s), Math.max(demandR * 1.6, 1.6 * s), 2.4 * s, 8),
        new THREE.MeshBasicMaterial({ visible: false })
      );
      pick.position.y = 0.6 * s;
      pick.userData = group.userData;
      group.add(pick);

      this.bundle.pickables.add(group);
      this.meshes[node.id] = { group, status, ring: stationRing };
      return;
    }

    // Invisible fat pick cylinder so clicking is easy.
    const pick = new THREE.Mesh(
      new THREE.CylinderGeometry(Math.max(demandR * 1.6, 1.6 * s), Math.max(demandR * 1.6, 1.6 * s), 2.4 * s, 8),
      new THREE.MeshBasicMaterial({ visible: false })
    );
    pick.position.y = 0.6 * s;
    pick.userData = group.userData;
    group.add(pick);

    this.bundle.pickables.add(group);
    this.meshes[node.id] = { group, status, ring: null };
  }

  // Called every frame: grows the waiting bar with queued passengers.
  update() {
    const z = zoomScale(this.bundle.camera, this.bundle.controls.target, this.mapKey);
    for (const node of Object.values(this.state.maps[this.mapKey].nodes)) {
      const m = this.meshes[node.id];
      if (!m) continue;
      m.group.traverse((o) => {
        if (o.userData?.labelBase) {
          o.scale.set(o.userData.labelBase.x * z, o.userData.labelBase.y * z, 1);
        }
      });
      if (!m.group.userData.waitBar) continue;
      const waiting = node.waiting.reduce((sum, g) => sum + g.count, 0);
      const cap = platformCapacity(this.mapKey, node, this.state);
      const fill = cap > 0 ? waiting / cap : 0;
      const bar = m.group.userData.waitBar;
      if (waiting < 1) {
        bar.visible = false;
      } else {
        bar.visible = true;
        const h = Math.min(3, 0.2 + fill * 1.4) * this.cfg.nodeScale;
        bar.scale.y = h;
        bar.position.y = h / 2;
        bar.material.color.setHex(node.crowded ? 0xff4444 : fill >= 0.7 ? 0xff8844 : 0xffd257);
      }
      if (m.ring?.material) {
        const base = new THREE.Color(m.ring.userData.baseColor ?? this.nodeColor(node));
        const stress = new THREE.Color(0xff4444);
        const tint = node.crowded ? Math.min(1, fill) : fill * 0.65;
        m.ring.material.color.copy(base).lerp(stress, tint);
      }
    }
  }
}
