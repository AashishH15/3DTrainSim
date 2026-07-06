import { getDeviceId } from "../util/deviceId.js";

const HANDLE_KEY = "overland.playerHandle";
const PROD_ENDPOINT = "https://overlandgame.netlify.app/.netlify/functions/leaderboard";

export function getSavedHandle() {
  return localStorage.getItem(HANDLE_KEY) || "";
}

export function saveHandle(handle) {
  if (handle) localStorage.setItem(HANDLE_KEY, handle.trim());
}

function getLocalMockBoard(map) {
  try {
    const data = localStorage.getItem(`overland.localLeaderboard_${map}`);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

function saveLocalMockBoard(map, entry) {
  try {
    let board = getLocalMockBoard(map);
    const idx = board.findIndex((e) => e.deviceId === entry.deviceId);
    if (idx >= 0) {
      if (entry.survivedSec >= board[idx].survivedSec) board[idx] = entry;
    } else {
      board.push(entry);
    }
    board.sort((a, b) => b.survivedSec - a.survivedSec);
    localStorage.setItem(`overland.localLeaderboard_${map}`, JSON.stringify(board.slice(0, 50)));
  } catch {}
}

function mergeBoardEntries(remoteEntries, localEntries) {
  const map = new Map();
  for (const entry of [...remoteEntries, ...localEntries]) {
    const key = `${entry.handle}_${entry.survivedSec}`;
    if (!map.has(key)) {
      map.set(key, entry);
    }
  }
  const merged = Array.from(map.values());
  merged.sort((a, b) => b.survivedSec - a.survivedSec);
  return merged.slice(0, 50);
}

export async function fetchLeaderboard(map = "usa") {
  const localEntries = getLocalMockBoard(map);

  // 1. Try relative function endpoint (Netlify environment)
  try {
    const res = await fetch(`/.netlify/functions/leaderboard?map=${encodeURIComponent(map)}`);
    const contentType = res.headers.get("content-type") || "";
    if (res.ok && contentType.includes("application/json")) {
      const data = await res.json();
      return { map, entries: mergeBoardEntries(data.entries || [], localEntries) };
    }
  } catch {}

  // 2. Fallback to production endpoint if running on local dev
  try {
    const prodRes = await fetch(`${PROD_ENDPOINT}?map=${encodeURIComponent(map)}`);
    const contentType = prodRes.headers.get("content-type") || "";
    if (prodRes.ok && contentType.includes("application/json")) {
      const data = await prodRes.json();
      return { map, entries: mergeBoardEntries(data.entries || [], localEntries) };
    }
  } catch {}

  // 3. Local mock fallback (offline / standalone local dev)
  return { map, entries: localEntries };
}

export async function submitLeaderboardScore({ handle, mode = "survival", map, survivedSec, trains, passengers }) {
  const deviceId = getDeviceId();
  const cleanHandle = handle.trim();
  saveHandle(cleanHandle);

  const payload = {
    handle: cleanHandle,
    mode,
    map,
    survivedSec: Math.round(survivedSec),
    trains: Math.max(1, trains),
    passengers: Math.max(0, passengers),
    deviceId,
  };

  // Always save to local localStorage so player runs are never lost locally
  const mockEntry = {
    handle: cleanHandle,
    survivedSec: Math.round(survivedSec),
    trains: Math.max(1, trains),
    passengers: Math.max(0, passengers),
    deviceId,
    date: new Date().toISOString().split("T")[0],
  };
  saveLocalMockBoard(map, mockEntry);

  // 1. Try local Netlify Function endpoint
  try {
    const res = await fetch("/.netlify/functions/leaderboard", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const contentType = res.headers.get("content-type") || "";
    if (res.ok && contentType.includes("application/json")) {
      return await res.json();
    }
  } catch {}

  // 2. Try production Netlify Function endpoint
  try {
    const prodRes = await fetch(PROD_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const contentType = prodRes.headers.get("content-type") || "";
    if (prodRes.ok && contentType.includes("application/json")) {
      return await prodRes.json();
    }
  } catch {}

  return { success: true, localMock: true, entry: mockEntry };
}
