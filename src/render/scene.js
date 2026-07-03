import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

export function createRenderer() {
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  document.getElementById("app").appendChild(renderer.domElement);
  return renderer;
}

export function createSceneBundle(renderer, opts) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(opts.background);
  scene.fog = new THREE.Fog(opts.background, opts.fogNear, opts.fogFar);

  const camera = new THREE.PerspectiveCamera(
    52, window.innerWidth / window.innerHeight, 0.5, 3000
  );
  camera.position.copy(opts.cameraPos);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.copy(opts.target);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.maxPolarAngle = 1.32;
  controls.minDistance = opts.minDist;
  controls.maxDistance = opts.maxDist;
  controls.enabled = false;
  controls.update();

  const ambient = new THREE.AmbientLight(0xcfd8ea, 1.15);
  scene.add(ambient);
  const sun = new THREE.DirectionalLight(0xfff2d8, 2.0);
  sun.position.set(-120, 180, -80);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  const s = opts.shadowExtent;
  sun.shadow.camera.left = -s;
  sun.shadow.camera.right = s;
  sun.shadow.camera.top = s;
  sun.shadow.camera.bottom = -s;
  sun.shadow.camera.far = 600;
  sun.shadow.bias = -0.0005;
  scene.add(sun);

  // Groups the interaction layer raycasts against.
  const pickables = new THREE.Group();
  scene.add(pickables);
  const trackGroup = new THREE.Group();
  scene.add(trackGroup);
  const trainGroup = new THREE.Group();
  scene.add(trainGroup);
  const previewGroup = new THREE.Group();
  scene.add(previewGroup);

  return { scene, camera, controls, pickables, trackGroup, trainGroup, previewGroup };
}

// Flat translucent water plane with a subtle animated wobble shader.
export function makeWater(size, color, y = 0.15) {
  const geo = new THREE.PlaneGeometry(size, size, 48, 48);
  const mat = new THREE.MeshLambertMaterial({
    color,
    transparent: true,
    opacity: 0.88,
  });
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = { value: 0 };
    mat.userData.shader = shader;
    shader.vertexShader = "uniform float uTime;\n" + shader.vertexShader.replace(
      "#include <begin_vertex>",
      `#include <begin_vertex>
       transformed.z += sin(position.x * 0.18 + uTime * 1.4) * 0.10
                      + cos(position.y * 0.22 + uTime * 1.1) * 0.10;`
    );
  };
  const mesh = new THREE.Mesh(geo, mat);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = y;
  mesh.receiveShadow = true;
  mesh.userData.isWater = true;
  return mesh;
}

export function tickWater(scene, t) {
  scene.traverse((o) => {
    if (o.userData.isWater && o.material.userData.shader) {
      o.material.userData.shader.uniforms.uTime.value = t;
    }
  });
}
