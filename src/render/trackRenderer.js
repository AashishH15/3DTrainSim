import * as THREE from "three";
import { TRACK_TYPES } from "../core/config.js";
import { isLandNYC } from "../data/nycMap.js";
import { MAP_RENDER } from "./constants.js";

// Draws track edges as elevated ribbons with periodic support piers.
export class TrackRenderer {
  constructor(mapKey, bundle, state) {
    this.mapKey = mapKey;
    this.bundle = bundle;
    this.state = state;
    this.meshes = {}; // edgeId -> group
    this.sync();
  }

  sync() {
    const edges = this.state.maps[this.mapKey].edges;
    for (const id in this.meshes) {
      if (!edges[id] || edges[id].type !== this.meshes[id].userData.builtType) {
        this.bundle.trackGroup.remove(this.meshes[id]);
        this.meshes[id].traverse((o) => o.geometry?.dispose());
        delete this.meshes[id];
      }
    }
    for (const id in edges) {
      if (!this.meshes[id]) {
        const g = this.buildEdge(edges[id]);
        this.meshes[id] = g;
        this.bundle.trackGroup.add(g);
      }
    }
  }

  buildEdge(edge) {
    const cfg = MAP_RENDER[this.mapKey];
    const ms = this.state.maps[this.mapKey];
    const na = ms.nodes[edge.a];
    const nb = ms.nodes[edge.b];
    const len = edge.length;
    const angle = Math.atan2(nb.x - na.x, nb.z - na.z);
    const color = TRACK_TYPES[edge.type].color;
    const scale = this.mapKey === "usa" ? 1.4 : 1.0;

    const group = new THREE.Group();
    group.position.set((na.x + nb.x) / 2, 0, (na.z + nb.z) / 2);
    group.rotation.y = angle;
    group.userData = { kind: "edge", id: edge.id, map: this.mapKey, builtType: edge.type };

    const y = cfg.trackY;

    // Deck ribbon.
    const deck = new THREE.Mesh(
      new THREE.BoxGeometry(0.5 * scale, 0.14 * scale, len),
      new THREE.MeshLambertMaterial({ color })
    );
    deck.position.y = y;
    deck.castShadow = true;
    deck.userData = group.userData;
    group.add(deck);

    // Maglev gets a center guide rail; standard gets darker ballast strip.
    if (edge.type === 3) {
      const rail = new THREE.Mesh(
        new THREE.BoxGeometry(0.14 * scale, 0.14 * scale, len),
        new THREE.MeshLambertMaterial({ color: 0xdcf0ff })
      );
      rail.position.y = y + 0.14 * scale;
      rail.userData = group.userData;
      group.add(rail);
    } else {
      const strip = new THREE.Mesh(
        new THREE.BoxGeometry(0.24 * scale, 0.05 * scale, len),
        new THREE.MeshLambertMaterial({ color: 0x4a5361 })
      );
      strip.position.y = y + 0.09 * scale;
      strip.userData = group.userData;
      group.add(strip);
    }

    // Support piers, taller over water.
    const spacing = this.mapKey === "usa" ? 14 : 5;
    const count = Math.max(1, Math.floor(len / spacing));
    const pierMat = new THREE.MeshLambertMaterial({ color: 0x8a8172 });
    for (let i = 1; i <= count; i++) {
      const t = i / (count + 1);
      const wx = na.x + (nb.x - na.x) * t;
      const wz = na.z + (nb.z - na.z) * t;
      const overWater = this.mapKey === "nyc" ? !isLandNYC(wx, wz) : false;
      const baseY = overWater ? 0 : cfg.landTop;
      const h = y - baseY;
      const pier = new THREE.Mesh(
        new THREE.BoxGeometry(0.22 * scale, h, 0.22 * scale),
        pierMat
      );
      pier.position.set(0, baseY + h / 2, -len / 2 + t * len);
      pier.userData = group.userData;
      group.add(pier);
    }

    // Invisible fat pick box for easy clicking.
    const pick = new THREE.Mesh(
      new THREE.BoxGeometry(1.6 * scale, 1.6 * scale, len),
      new THREE.MeshBasicMaterial({ visible: false })
    );
    pick.position.y = y;
    pick.userData = group.userData;
    group.add(pick);

    return group;
  }
}
