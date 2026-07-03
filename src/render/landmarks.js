import * as THREE from "three";

const mat = (color) => new THREE.MeshLambertMaterial({ color, flatShading: true });

function box(w, h, d, color, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(color));
  m.position.set(x, y + h / 2, z);
  m.castShadow = true;
  return m;
}

function cyl(rt, rb, h, color, x = 0, y = 0, z = 0, seg = 8) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat(color));
  m.position.set(x, y + h / 2, z);
  m.castShadow = true;
  return m;
}

function cone(r, h, color, x = 0, y = 0, z = 0, seg = 6) {
  const m = new THREE.Mesh(new THREE.ConeGeometry(r, h, seg), mat(color));
  m.position.set(x, y + h / 2, z);
  m.castShadow = true;
  return m;
}

function sphere(r, color, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(new THREE.SphereGeometry(r, 8, 6), mat(color));
  m.position.set(x, y, z);
  m.castShadow = true;
  return m;
}

// Each builder returns a THREE.Group with its base at y=0.
export const LANDMARK_BUILDERS = {
  owtc() {
    const g = new THREE.Group();
    const tower = new THREE.Mesh(new THREE.CylinderGeometry(0.72, 1.06, 9, 4), mat(0xbfd9ee));
    tower.position.y = 4.5;
    tower.rotation.y = Math.PI / 4;
    tower.castShadow = true;
    g.add(tower);
    g.add(cyl(0.05, 0.05, 2.2, 0xdde9f3, 0, 9));
    g.add(box(1.2, 3.2, 1.2, 0xa8c6e0, 2, 0, 1.2));
    g.add(box(1, 2.4, 1, 0x9db8d2, -1.8, 0, 1));
    return g;
  },
  esb() {
    const g = new THREE.Group();
    g.add(box(2.2, 3.2, 2.2, 0xd9c8a9));
    g.add(box(1.6, 2.6, 1.6, 0xcdbd9e, 0, 3.2));
    g.add(box(1.0, 2.2, 1.0, 0xc2b294, 0, 5.8));
    g.add(cyl(0.04, 0.16, 1.8, 0xb8a88a, 0, 8));
    return g;
  },
  chrysler() {
    const g = new THREE.Group();
    g.add(box(1.6, 4.6, 1.6, 0xc9cfd8));
    for (let i = 0; i < 4; i++) {
      g.add(cyl(0.55 - i * 0.12, 0.72 - i * 0.12, 0.55, 0xdfe6ee, 0, 4.6 + i * 0.55));
    }
    g.add(cone(0.12, 1.3, 0xeef2f7, 0, 6.8));
    return g;
  },
  grandcentral() {
    const g = new THREE.Group();
    g.add(box(2.8, 1.4, 1.9, 0xd8c9a8));
    const vault = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 0.85, 2.6, 10, 1, false, 0, Math.PI), mat(0xc7b493));
    vault.rotation.z = Math.PI / 2;
    vault.position.y = 1.4;
    vault.castShadow = true;
    g.add(vault);
    g.add(cyl(0.1, 0.1, 0.9, 0xb8a888, 1.2, 1.4, 0.7));
    g.add(cyl(0.1, 0.1, 0.9, 0xb8a888, -1.2, 1.4, 0.7));
    return g;
  },
  timessq() {
    const g = new THREE.Group();
    g.add(box(1.3, 5.5, 1.3, 0x88a0b8));
    g.add(box(1.5, 0.9, 0.1, 0xff6b6b, 0, 3.4, 0.72));
    g.add(box(1.5, 0.7, 0.1, 0x4cd97b, 0, 2.2, 0.72));
    g.add(box(0.1, 0.8, 1.4, 0x55b6ff, 0.72, 2.8, 0));
    g.add(box(1.1, 3.4, 1.1, 0x7890a8, 1.7, 0, -1));
    g.add(box(0.9, 2.6, 0.9, 0x98abc0, -1.6, 0, -0.8));
    return g;
  },
  hudson() {
    const g = new THREE.Group();
    g.add(box(1.1, 4.6, 1.1, 0x9fb6c8, -0.8, 0, 0));
    g.add(box(1.1, 3.6, 1.1, 0x8ba6bb, 0.7, 0, 0.4));
    g.add(cyl(0.7, 0.35, 0.9, 0xc98a4b, 0, 0, -1.2));
    return g;
  },
  un() {
    const g = new THREE.Group();
    g.add(box(2.4, 5.4, 0.5, 0x9fc6de));
    g.add(box(2.2, 0.8, 1.6, 0xd8cfc0, 0, 0, 1));
    return g;
  },
  park() {
    const g = new THREE.Group();
    for (let i = 0; i < 7; i++) {
      const x = (Math.random() - 0.5) * 3;
      const z = (Math.random() - 0.5) * 3;
      g.add(cyl(0.08, 0.08, 0.35, 0x8a6742, x, 0, z));
      g.add(cone(0.45, 1.1, 0x3fae6a, x, 0.32, z));
    }
    return g;
  },
  village() {
    const g = new THREE.Group();
    const colors = [0xd98d64, 0xc97a5a, 0xb86a50];
    for (let i = 0; i < 5; i++) {
      g.add(box(0.8, 0.9 + (i % 3) * 0.35, 0.8, colors[i % 3], (i - 2) * 0.9, 0, (i % 2) * 0.9 - 0.4));
    }
    return g;
  },
  highline() {
    const g = new THREE.Group();
    g.add(box(4, 0.18, 0.7, 0x6da874, 0, 0.8, 0));
    for (let i = -2; i <= 2; i++) g.add(cyl(0.08, 0.08, 0.8, 0x54626e, i, 0, 0));
    g.add(box(0.9, 2.4, 0.9, 0xb8a4c8, -1.4, 0, 1.2));
    g.add(box(0.8, 1.7, 0.8, 0xa090b8, 1.5, 0, 1.1));
    return g;
  },
  intrepid() {
    const g = new THREE.Group();
    g.add(box(3.4, 0.5, 1.1, 0x6b7c8c));
    g.add(box(3.6, 0.16, 1.3, 0x8a9aa8, 0, 0.5, 0));
    g.add(box(0.5, 0.9, 0.4, 0x5a6a78, 0.8, 0.66, -0.3));
    g.add(box(0.55, 0.1, 0.5, 0xc8d2da, -0.8, 0.66, 0.1));
    return g;
  },
  stadium() {
    const g = new THREE.Group();
    g.add(cyl(2.1, 2.3, 1.1, 0xdfe4ea, 0, 0, 0, 12));
    g.add(cyl(1.5, 1.5, 0.2, 0x4cae5f, 0, 1.0, 0, 12));
    return g;
  },
  coney() {
    const g = new THREE.Group();
    const wheel = new THREE.Mesh(new THREE.TorusGeometry(1.3, 0.09, 6, 14), mat(0xff8f5a));
    wheel.position.y = 1.7;
    wheel.castShadow = true;
    g.add(wheel);
    g.add(cyl(0.09, 0.09, 1.7, 0x8a95a2, -0.5, 0, 0));
    g.add(cyl(0.09, 0.09, 1.7, 0x8a95a2, 0.5, 0, 0));
    g.add(box(1.6, 0.5, 0.8, 0xffc46b, 2, 0, 0.4));
    return g;
  },
  unisphere() {
    const g = new THREE.Group();
    const globe = new THREE.Mesh(
      new THREE.SphereGeometry(1.1, 10, 8),
      new THREE.MeshLambertMaterial({ color: 0xb8c4ce, wireframe: true })
    );
    globe.position.y = 1.8;
    g.add(globe);
    g.add(cyl(0.5, 0.7, 0.4, 0x9aa6b2));
    return g;
  },
  airport() {
    const g = new THREE.Group();
    g.add(box(3.4, 0.6, 1.2, 0xc8d2dc));
    g.add(cyl(0.18, 0.24, 1.9, 0x8a97a5, 1.9, 0, 0.6));
    g.add(box(0.8, 0.5, 0.8, 0xaebac6, 1.9, 1.9, 0.6));
    g.add(box(4.5, 0.06, 0.7, 0x525c66, 0, 0, 2));
    return g;
  },
  liberty() {
    const g = new THREE.Group();
    g.add(box(1.1, 0.9, 1.1, 0xc9b796));
    g.add(cyl(0.42, 0.55, 0.5, 0xb5a384, 0, 0.9));
    g.add(cone(0.42, 1.9, 0x5fc490, 0, 1.4, 0, 7));
    g.add(sphere(0.22, 0x5fc490, 0, 3.45, 0));
    g.add(cyl(0.05, 0.05, 0.9, 0x5fc490, 0.32, 3.3, 0));
    g.add(cone(0.14, 0.3, 0xffd257, 0.32, 4.2, 0, 5));
    return g;
  },
  ellis() {
    const g = new THREE.Group();
    g.add(box(1.8, 0.8, 1.0, 0xc86a5a));
    for (const dx of [-0.7, 0.7]) {
      g.add(cyl(0.16, 0.2, 1.2, 0xd8d2c4, dx, 0.8, -0.3));
      g.add(sphere(0.24, 0x88b8c8, dx, 2.15, -0.3));
    }
    return g;
  },
  governors() {
    const g = new THREE.Group();
    g.add(cyl(0.7, 0.9, 0.7, 0x9aa88a, -0.6, 0, 0));
    g.add(cone(0.5, 1, 0x3fae6a, 0.8, 0, 0.4));
    g.add(cone(0.4, 0.8, 0x3fae6a, 1.2, 0, -0.5));
    return g;
  },
};
