import * as THREE from "three";
import { TIERS } from "../core/config.js";
import { MAP_RENDER } from "./constants.js";

const mat = (color) => new THREE.MeshLambertMaterial({ color, flatShading: true });

// Chunky toy-like train models, one silhouette per tier.
function buildTier1() {
  const g = new THREE.Group();
  // Boxy loco: cab + long hood + chimney.
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.7, 2.6), mat(0x4cd97b));
  body.position.y = 0.55;
  g.add(body);
  const cab = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.55, 0.8), mat(0x2fa85b));
  cab.position.set(0, 1.1, 0.7);
  g.add(cab);
  const chimney = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.14, 0.4, 8), mat(0x2c3646));
  chimney.position.set(0, 1.1, -0.9);
  g.add(chimney);
  // Trailing car.
  const car = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.6, 2.0), mat(0xd8dee6));
  car.position.set(0, 0.5, 2.7);
  g.add(car);
  addWheels(g, [-0.9, 0.1, 2.2, 3.2], 0x2c3646);
  return g;
}

function buildTier2() {
  const g = new THREE.Group();
  // Sleek: low, long body with a tapered nose cone.
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.55, 3.0), mat(0xffb547));
  body.position.y = 0.5;
  g.add(body);
  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.42, 1.1, 4), mat(0xffc46b));
  nose.rotation.x = -Math.PI / 2;
  nose.rotation.y = Math.PI / 4;
  nose.position.set(0, 0.5, -2.05);
  g.add(nose);
  const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.84, 0.14, 3.0), mat(0x2c3646));
  stripe.position.y = 0.62;
  g.add(stripe);
  const car = new THREE.Mesh(new THREE.BoxGeometry(0.76, 0.5, 2.4), mat(0xf2e3c8));
  car.position.set(0, 0.48, 2.9);
  g.add(car);
  addWheels(g, [-1.1, 0.4, 2.0, 3.7], 0x3a4556);
  return g;
}

function buildTier3() {
  const g = new THREE.Group();
  // Floating maglev pod: capsule, no wheels, glow skirt.
  const pod = new THREE.Mesh(new THREE.CapsuleGeometry(0.42, 2.2, 4, 10), mat(0x55b6ff));
  pod.rotation.x = Math.PI / 2;
  pod.position.y = 0.75;
  g.add(pod);
  const canopy = new THREE.Mesh(new THREE.CapsuleGeometry(0.28, 1.0, 4, 8), mat(0xdcf0ff));
  canopy.rotation.x = Math.PI / 2;
  canopy.position.set(0, 1.02, -0.3);
  g.add(canopy);
  const skirt = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.12, 2.6),
    new THREE.MeshLambertMaterial({ color: 0xbfe6ff, emissive: 0x3388cc }));
  skirt.position.y = 0.3;
  g.add(skirt);
  return g;
}

const BUILDERS = { 1: buildTier1, 2: buildTier2, 3: buildTier3 };

function addWheels(g, zs, color) {
  for (const z of zs) {
    for (const x of [-0.42, 0.42]) {
      const w = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.1, 8), mat(color));
      w.rotation.z = Math.PI / 2;
      w.position.set(x, 0.16, z);
      g.add(w);
    }
  }
}

export class TrainRenderer {
  constructor(mapKey, bundle, state) {
    this.mapKey = mapKey;
    this.bundle = bundle;
    this.state = state;
    this.meshes = {}; // trainId -> group
  }

  sync() {
    const trains = this.state.trains;
    for (const id in this.meshes) {
      if (!trains[id] || trains[id].map !== this.mapKey) {
        this.bundle.trainGroup.remove(this.meshes[id]);
        this.meshes[id].traverse((o) => o.geometry?.dispose());
        delete this.meshes[id];
      }
    }
    for (const id in trains) {
      const t = trains[id];
      if (t.map !== this.mapKey || this.meshes[id]) continue;
      const g = BUILDERS[t.tier]();
      g.traverse((o) => { o.castShadow = true; });
      const s = MAP_RENDER[this.mapKey].trainScale;
      g.scale.setScalar(s);
      g.userData = { kind: "train", id, map: this.mapKey };
      g.traverse((o) => (o.userData = g.userData));
      this.bundle.trainGroup.add(g);
      this.meshes[id] = g;
    }
  }

  update() {
    this.sync();
    const cfg = MAP_RENDER[this.mapKey];
    const ms = this.state.maps[this.mapKey];
    for (const id in this.meshes) {
      const train = this.state.trains[id];
      const g = this.meshes[id];
      if (!train.path || train.state === "idle") {
        // Idle trains park at their first route stop (or map corner).
        const home = ms.nodes[train.route[0]];
        if (home) g.position.set(home.x + 2, cfg.trackY + 0.1, home.z + 2);
        else g.position.set(0, cfg.trackY + 0.1, 0);
        continue;
      }
      const a = ms.nodes[train.path[train.seg]];
      const b = ms.nodes[train.path[train.seg + 1]];
      if (!a || !b) continue;
      const segLen = Math.hypot(b.x - a.x, b.z - a.z) || 1;
      const t = Math.min(1, train.prog / segLen);
      const x = a.x + (b.x - a.x) * t;
      const z = a.z + (b.z - a.z) * t;
      g.position.set(x, cfg.trackY + 0.08 * cfg.trainScale, z);
      g.rotation.y = Math.atan2(b.x - a.x, b.z - a.z) + Math.PI;
    }
  }
}
