import { getStore } from "@netlify/blobs";

const BAD_WORDS = new Set([
  "admin", "mod", "moderator", "system", "null", "undefined",
  "fuck", "shit", "cunt", "nigger", "faggot", "bitch", "asshole", "dick", "pussy", "whore", "slut", "chink", "kike"
]);

function isCleanHandle(handle) {
  if (!handle || typeof handle !== "string") return false;
  const trimmed = handle.trim();
  if (trimmed.length < 2 || trimmed.length > 20) return false;
  if (!/^[a-zA-Z0-9 _-]+$/.test(trimmed)) return false;
  const lower = trimmed.toLowerCase();
  for (const word of BAD_WORDS) {
    if (lower.includes(word)) return false;
  }
  return true;
}

function maxPlausiblePassengers(survivedSec, trains) {
  const perTrainPerSec = 420 / 20; // ~21 pax/sec per train ceiling
  return Math.ceil(survivedSec * trains * perTrainPerSec * 3);
}

let inMemoryStore = new Map();

function getSafeStore(storeName) {
  try {
    return getStore(storeName);
  } catch (err) {
    console.error("getStore failed, checking environment for fallback. Error details:", err);
    const isLocalDev = process.env.NETLIFY_DEV === "true" || !process.env.NETLIFY;
    if (isLocalDev) {
      console.log("Local development environment detected. Falling back to transient in-memory store.");
      return {
        async get(key, options) {
          const val = inMemoryStore.get(`${storeName}:${key}`);
          if (!val) return null;
          if (options?.type === "json") return JSON.parse(val);
          return val;
        },
        async setJSON(key, value) {
          inMemoryStore.set(`${storeName}:${key}`, JSON.stringify(value));
        }
      };
    }
    // In production Netlify environment, rethrow the error so it fails explicitly instead of hiding the issue.
    throw err;
  }
}

export async function handler(event) {
  const headers = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  };

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers, body: "" };
  }

  const store = getSafeStore("survival-leaderboard");

  if (event.httpMethod === "GET") {
    try {
      const url = new URL(event.rawUrl || `http://localhost${event.path}`);
      const map = url.searchParams.get("map") === "nyc" ? "nyc" : "usa";

      const boardKey = `board_${map}`;
      const data = await store.get(boardKey, { type: "json" });
      const entries = Array.isArray(data) ? data : [];

      entries.sort((a, b) => b.survivedSec - a.survivedSec);
      const topEntries = entries.slice(0, 50).map((e) => ({
        handle: e.handle,
        survivedSec: e.survivedSec,
        passengers: e.passengers,
        trains: e.trains,
        date: e.date,
        deviceId: e.deviceId,
      }));

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ map, entries: topEntries }),
      };
    } catch (err) {
      console.error("GET leaderboard error:", err);
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ map: "usa", entries: [] }),
      };
    }
  }

  if (event.httpMethod === "POST") {
    try {
      const body = JSON.parse(event.body || "{}");
      const { handle, mode, map, survivedSec, trains, passengers, deviceId } = body;

      if (!isCleanHandle(handle)) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: "Invalid or inappropriate handle (2-20 alphanumeric characters)" }) };
      }
      if (mode !== "survival" || !["usa", "nyc"].includes(map)) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: "Invalid game mode or map" }) };
      }
      if (!deviceId || typeof deviceId !== "string" || deviceId.length < 6) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: "Missing device identification" }) };
      }
      const numSec = Number(survivedSec);
      if (isNaN(numSec) || numSec <= 0 || numSec > 36 * 3600) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: "Implausible survival time" }) };
      }
      const trainCount = Math.max(1, Math.round(Number(trains) || 1));
      const paxCount = Math.max(0, Math.round(Number(passengers) || 0));

      if (paxCount > maxPlausiblePassengers(numSec, trainCount)) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: "Implausible passenger count for recorded run time" }) };
      }

      // Rate limit check: 30 seconds per deviceId
      const deviceKey = `device_${deviceId}`;
      const deviceRecord = (await store.get(deviceKey, { type: "json" })) || {};
      const now = Date.now();
      if (deviceRecord.lastSubmit && now - deviceRecord.lastSubmit < 30000) {
        const waitSec = Math.ceil((30000 - (now - deviceRecord.lastSubmit)) / 1000);
        return { statusCode: 429, headers, body: JSON.stringify({ error: `Rate limit: please wait ${waitSec}s before submitting again` }) };
      }

      await store.setJSON(deviceKey, { lastSubmit: now });

      // Fetch current board for this map
      const boardKey = `board_${map}`;
      let entries = (await store.get(boardKey, { type: "json" })) || [];
      if (!Array.isArray(entries)) entries = [];

      const cleanHandleStr = handle.trim();
      const existingIdx = entries.findIndex((e) => e.deviceId === deviceId);
      const newEntry = {
        handle: cleanHandleStr,
        survivedSec: Math.round(numSec),
        trains: trainCount,
        passengers: paxCount,
        deviceId,
        date: new Date().toISOString().split("T")[0],
      };

      if (existingIdx >= 0) {
        if (newEntry.survivedSec >= entries[existingIdx].survivedSec) {
          entries[existingIdx] = newEntry;
        }
      } else {
        entries.push(newEntry);
      }

      entries.sort((a, b) => b.survivedSec - a.survivedSec);
      if (entries.length > 100) entries = entries.slice(0, 100);

      await store.setJSON(boardKey, entries);

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ success: true, entry: newEntry }),
      };
    } catch (err) {
      console.error("POST leaderboard error:", err);
      return { statusCode: 500, headers, body: JSON.stringify({ error: "Server error saving score" }) };
    }
  }

  return { statusCode: 405, headers, body: JSON.stringify({ error: "Method Not Allowed" }) };
}
