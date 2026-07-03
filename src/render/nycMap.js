import * as THREE from "three";
import { LANDMASSES, NYC_STOPS, DECOR_BRIDGES, CENTRAL_PARK, pointInPoly } from "../data/nycMap.js";
import { LANDMARK_BUILDERS } from "./landmarks.js";
import { makeWater } from "./scene.js";
import { MAP_RENDER } from "./constants.js";

const LAND_DEPTH = MAP_RENDER.nyc.landTop;

// Deterministic PRNG so the city looks the same every session.
function mulberry32(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function polyBounds(poly) {
  let x0 = Infinity, z0 = Infinity, x1 = -Infinity, z1 = -Infinity;
  for (const [x, z] of poly) {
    x0 = Math.min(x0, x); x1 = Math.max(x1, x);
    z0 = Math.min(z0, z); z1 = Math.max(z1, z);
  }
  return { x0, z0, x1, z1 };
}

export function buildNycTerrain(scene) {
  scene.add(makeWater(400, 0x3d85c6, 0.12));

  const rand = mulberry32(1337);
  const stopClear = NYC_STOPS.map((s) => [s.x, s.z]);

  for (const lm of LANDMASSES) {
    // Extruded landmass slab.
    const shape = new THREE.Shape(lm.poly.map(([x, z]) => new THREE.Vector2(x, -z)));
    const geo = new THREE.ExtrudeGeometry(shape, { depth: LAND_DEPTH, bevelEnabled: false });
    const mesh = new THREE.Mesh(geo, [
      new THREE.MeshLambertMaterial({ color: lm.color, flatShading: true }),
      new THREE.MeshLambertMaterial({ color: 0xa89577, flatShading: true }),
    ]);
    mesh.rotation.x = -Math.PI / 2;
    mesh.receiveShadow = true;
    scene.add(mesh);

    // Procedural buildings scattered on the landmass.
    if (lm.buildingCount > 0) {
      const b = polyBounds(lm.poly);
      const geoBox = new THREE.BoxGeometry(1, 1, 1);
      const matBox = new THREE.MeshLambertMaterial({ color: lm.buildingColor, flatShading: true });
      const inst = new THREE.InstancedMesh(geoBox, matBox, lm.buildingCount);
      inst.castShadow = true;
      const dummy = new THREE.Object3D();
      let placed = 0;
      let attempts = 0;
      while (placed < lm.buildingCount && attempts < lm.buildingCount * 40) {
        attempts++;
        const x = b.x0 + rand() * (b.x1 - b.x0);
        const z = b.z0 + rand() * (b.z1 - b.z0);
        if (!pointInPoly(x, z, lm.poly)) continue;
        // Keep clear of stops/landmarks and Central Park.
        if (stopClear.some(([sx, sz]) => Math.hypot(x - sx, z - sz) < 4)) continue;
        if (lm.id === "manhattan" &&
            x > CENTRAL_PARK.x0 - 1 && x < CENTRAL_PARK.x1 + 1 &&
            z > CENTRAL_PARK.z0 - 1 && z < CENTRAL_PARK.z1 + 1) continue;

        let h = 0.5 + rand() * 1.2;
        if (lm.id === "manhattan") {
          // Taller clusters in midtown and downtown.
          const midtown = Math.abs(z - 8) < 14;
          const downtown = Math.abs(z - 46) < 8;
          h = 0.7 + rand() * 1.5 + (midtown ? rand() * 3.2 : 0) + (downtown ? rand() * 2.6 : 0);
        }
        const w = 0.6 + rand() * 0.9;
        dummy.position.set(x, LAND_DEPTH + h / 2, z);
        dummy.scale.set(w, h, 0.6 + rand() * 0.9);
        dummy.rotation.y = rand() * 0.4 - 0.2;
        dummy.updateMatrix();
        inst.setMatrixAt(placed++, dummy.matrix);
      }
      inst.count = placed;
      scene.add(inst);
    }
  }

  // Central Park green patch.
  const cp = CENTRAL_PARK;
  const park = new THREE.Mesh(
    new THREE.BoxGeometry(cp.x1 - cp.x0, 0.14, cp.z1 - cp.z0),
    new THREE.MeshLambertMaterial({ color: 0x63c07a, flatShading: true })
  );
  park.position.set((cp.x0 + cp.x1) / 2, LAND_DEPTH + 0.07, (cp.z0 + cp.z1) / 2);
  park.receiveShadow = true;
  scene.add(park);
  const rand2 = mulberry32(99);
  for (let i = 0; i < 16; i++) {
    const x = cp.x0 + 0.6 + rand2() * (cp.x1 - cp.x0 - 1.2);
    const z = cp.z0 + 0.6 + rand2() * (cp.z1 - cp.z0 - 1.2);
    const tree = new THREE.Mesh(new THREE.ConeGeometry(0.4, 1.0, 6),
      new THREE.MeshLambertMaterial({ color: 0x3fae6a, flatShading: true }));
    tree.position.set(x, LAND_DEPTH + 0.6, z);
    tree.castShadow = true;
    scene.add(tree);
  }

  // Landmark models at their stops.
  for (const stop of NYC_STOPS) {
    if (!stop.landmark || !LANDMARK_BUILDERS[stop.landmark]) continue;
    const model = LANDMARK_BUILDERS[stop.landmark]();
    // Offset slightly so the station marker at the node stays visible.
    model.position.set(stop.x + 1.6, LAND_DEPTH, stop.z - 1.6);
    scene.add(model);
  }

  // Decorative suspension bridges.
  for (const br of DECOR_BRIDGES) {
    scene.add(buildBridge(br));
  }
}

function buildBridge({ from, to }) {
  const g = new THREE.Group();
  const [ax, az] = from;
  const [bx, bz] = to;
  const len = Math.hypot(bx - ax, bz - az);
  const angle = Math.atan2(bx - ax, bz - az);
  const deckY = 1.35;

  const deck = new THREE.Mesh(
    new THREE.BoxGeometry(0.7, 0.12, len),
    new THREE.MeshLambertMaterial({ color: 0x9a8a72, flatShading: true })
  );
  deck.castShadow = true;
  g.add(deck);
  deck.position.y = deckY;

  const towerMat = new THREE.MeshLambertMaterial({ color: 0x7d6f5c, flatShading: true });
  for (const t of [0.28, 0.72]) {
    const tower = new THREE.Mesh(new THREE.BoxGeometry(1.0, 2.6, 0.3), towerMat);
    tower.position.set(0, deckY + 0.9, -len / 2 + t * len);
    tower.castShadow = true;
    g.add(tower);
  }

  g.position.set((ax + bx) / 2, 0, (az + bz) / 2);
  g.rotation.y = angle;
  return g;
}
