import { TRACK_TYPES } from "./config.js";

export const edgeKey = (a, b) => (a < b ? `${a}|${b}` : `${b}|${a}`);

/** Trains currently moving along this track segment. */
export function trainsOnEdge(state, mapKey, edgeId) {
  if (!state.maps[mapKey]?.edges[edgeId]) return [];
  const out = [];
  for (const train of Object.values(state.trains)) {
    if (train.map !== mapKey || train.state !== "run" || !train.path?.length) continue;
    const a = train.path[train.seg];
    const b = train.path[train.seg + 1];
    if (a && b && edgeKey(a, b) === edgeId) out.push(train);
  }
  return out;
}

export function nodeDist(na, nb) {
  return Math.hypot(na.x - nb.x, na.z - nb.z);
}

// Adjacency: nodeId -> [{ to, edge }], filtered by tier if given.
function adjacency(mapState, tier = null) {
  const adj = {};
  for (const edge of Object.values(mapState.edges)) {
    if (tier !== null && !TRACK_TYPES[edge.type].allows(tier)) continue;
    (adj[edge.a] ??= []).push({ to: edge.b, edge });
    (adj[edge.b] ??= []).push({ to: edge.a, edge });
  }
  return adj;
}

// Dijkstra over the track graph. Returns { dist: {id:num}, prev: {id:id} }.
export function dijkstra(mapState, source, tier = null) {
  const adj = adjacency(mapState, tier);
  const dist = { [source]: 0 };
  const prev = {};
  const visited = new Set();
  // Small graphs (<100 nodes): a simple scan-based priority pick is fine.
  while (true) {
    let u = null;
    let best = Infinity;
    for (const id in dist) {
      if (!visited.has(id) && dist[id] < best) {
        best = dist[id];
        u = id;
      }
    }
    if (u === null) break;
    visited.add(u);
    for (const { to, edge } of adj[u] ?? []) {
      const nd = dist[u] + edge.length;
      if (nd < (dist[to] ?? Infinity)) {
        dist[to] = nd;
        prev[to] = u;
      }
    }
  }
  return { dist, prev };
}

// Shortest node-id path a..b usable by `tier` (null = any track). Null if none.
export function shortestPath(mapState, a, b, tier = null) {
  if (a === b) return { path: [a], dist: 0 };
  const { dist, prev } = dijkstra(mapState, a, tier);
  if (dist[b] === undefined) return null;
  const path = [b];
  let cur = b;
  while (cur !== a) {
    cur = prev[cur];
    path.push(cur);
  }
  path.reverse();
  return { path, dist: dist[b] };
}

// --- cached reachability + distances, invalidated via mapState.pathVersion ---

const cache = new Map(); // mapKey -> { version, dijkstras: Map(origin -> result) }

export function bumpPathVersion(mapState) {
  mapState.pathVersion = (mapState.pathVersion ?? 0) + 1;
}

function cacheFor(mapKey, mapState) {
  let c = cache.get(mapKey);
  if (!c || c.version !== (mapState.pathVersion ?? 0)) {
    c = { version: mapState.pathVersion ?? 0, dijkstras: new Map() };
    cache.set(mapKey, c);
  }
  return c;
}

export function cachedDijkstra(mapKey, mapState, origin) {
  const c = cacheFor(mapKey, mapState);
  if (!c.dijkstras.has(origin)) {
    c.dijkstras.set(origin, dijkstra(mapState, origin, null));
  }
  return c.dijkstras.get(origin);
}

// Station nodes reachable from `origin` over any track (excluding itself).
export function reachableStations(mapKey, mapState, origin) {
  const { dist } = cachedDijkstra(mapKey, mapState, origin);
  const out = [];
  for (const id in dist) {
    if (id !== origin && mapState.nodes[id]?.station) {
      out.push({ id, dist: dist[id] });
    }
  }
  return out;
}
