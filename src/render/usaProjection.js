import { geoAlbersUsa } from "d3-geo";

// d3's Albers USA composite projection, mapped into world units.
// Default projection fits a 975x610 canvas; we recenter and scale it.
export const USA_SCALE = 0.28;
const proj = geoAlbersUsa(); // scale 1070, translate [487.5, 305]

export function projectLonLat(lon, lat) {
  const p = proj([lon, lat]);
  if (!p) return null;
  return [(p[0] - 487.5) * USA_SCALE, (p[1] - 305) * USA_SCALE];
}

export function projectMetro(m) {
  return projectLonLat(m.lon, m.lat);
}
