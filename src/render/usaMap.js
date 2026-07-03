import * as THREE from "three";
import * as topojson from "topojson-client";
import us from "us-atlas/states-10m.json";
import { geoAlbersUsa } from "d3-geo";
import { USA_SCALE } from "./usaProjection.js";
import { makeWater } from "./scene.js";

const proj = geoAlbersUsa();

function toWorld(lonLat) {
  const p = proj(lonLat);
  if (!p) return null;
  return [(p[0] - 487.5) * USA_SCALE, (p[1] - 305) * USA_SCALE];
}

function ringArea(ring) {
  let a = 0;
  for (let i = 0; i < ring.length - 1; i++) {
    a += ring[i][0] * ring[i + 1][1] - ring[i + 1][0] * ring[i][1];
  }
  return Math.abs(a / 2);
}

// Builds the low-poly USA: extruded nation landmass, state border lines, ocean.
export function buildUsaTerrain(scene) {
  scene.add(makeWater(900, 0x2b6cb0, 0));

  const nationFC = topojson.feature(us, us.objects.nation);
  const nation = nationFC.type === "FeatureCollection" ? nationFC.features[0] : nationFC;
  const landMat = new THREE.MeshLambertMaterial({ color: 0xe9ddc4, flatShading: true });
  const sideMat = new THREE.MeshLambertMaterial({ color: 0xc9b795, flatShading: true });

  const polys = nation.geometry.type === "MultiPolygon"
    ? nation.geometry.coordinates
    : [nation.geometry.coordinates];

  for (const poly of polys) {
    const outer = poly[0].map(toWorld).filter(Boolean);
    if (outer.length < 12) continue;
    if (ringArea(outer) < 6) continue; // skip tiny islets
    const shape = new THREE.Shape(outer.map(([x, z]) => new THREE.Vector2(x, -z)));
    for (let h = 1; h < poly.length; h++) {
      const hole = poly[h].map(toWorld).filter(Boolean);
      if (hole.length > 8) {
        shape.holes.push(new THREE.Path(hole.map(([x, z]) => new THREE.Vector2(x, -z))));
      }
    }
    const geo = new THREE.ExtrudeGeometry(shape, { depth: 1.4, bevelEnabled: false });
    const mesh = new THREE.Mesh(geo, [landMat, sideMat]);
    mesh.rotation.x = -Math.PI / 2; // shape XY -> world XZ (y flip handled above)
    mesh.position.y = 0;
    mesh.receiveShadow = true;
    mesh.castShadow = false;
    scene.add(mesh);
  }

  // State borders as a single line mesh, slightly above the land.
  const bordersGeo = topojson.mesh(us, us.objects.states, (a, b) => a !== b);
  const positions = [];
  const addLine = (coords) => {
    for (let i = 0; i < coords.length - 1; i++) {
      const a = toWorld(coords[i]);
      const b = toWorld(coords[i + 1]);
      if (!a || !b) continue;
      positions.push(a[0], 1.52, a[1], b[0], 1.52, b[1]);
    }
  };
  if (bordersGeo.type === "MultiLineString") bordersGeo.coordinates.forEach(addLine);
  else addLine(bordersGeo.coordinates);

  const lineGeo = new THREE.BufferGeometry();
  lineGeo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  const lines = new THREE.LineSegments(
    lineGeo,
    new THREE.LineBasicMaterial({ color: 0xa89877, transparent: true, opacity: 0.85 })
  );
  scene.add(lines);
}
