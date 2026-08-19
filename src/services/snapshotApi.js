import { readFileSync, writeFileSync } from "node:fs";

import { createSnapshotStore } from "./snapshotStore.js";

export function loadSavedStore(filePath) {
  try {
    const saved = JSON.parse(readFileSync(filePath, "utf8"));
    if (typeof saved?.rev === "number") return { rev: saved.rev, snapshot: saved.snapshot ?? null };
  } catch {
    /* missing or corrupt file starts empty */
  }
  return { rev: 0, snapshot: null };
}

export function persistStore(filePath, payload) {
  writeFileSync(filePath, JSON.stringify(payload));
}

export function createFileSnapshotStore(filePath) {
  const store = createSnapshotStore(loadSavedStore(filePath));
  return {
    get() {
      return store.get();
    },
    put(clientRev, nextSnapshot) {
      const result = store.put(clientRev, nextSnapshot);
      if (result.ok) persistStore(filePath, { rev: result.rev, snapshot: result.snapshot });
      return result;
    },
  };
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => {
      const text = Buffer.concat(chunks).toString("utf8");
      if (!text) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(text));
      } catch (error) {
        reject(error);
      }
    });
    req.on("error", reject);
  });
}

function sendJson(res, status, body) {
  const payload = JSON.stringify(body);
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.end(payload);
}

export function snapshotMiddleware(store) {
  return async function posSnapshotApi(req, res, next) {
    const path = (req.url ?? "").split("?")[0];
    if (path !== "/api/snapshot") {
      next();
      return;
    }

    if (req.method === "GET") {
      sendJson(res, 200, store.get());
      return;
    }

    if (req.method === "PUT") {
      let body;
      try {
        body = await readBody(req);
      } catch {
        sendJson(res, 400, { error: "Invalid JSON." });
        return;
      }
      const result = store.put(Number(body.rev), body.snapshot);
      if (result.ok) {
        sendJson(res, 200, { rev: result.rev, snapshot: result.snapshot });
        return;
      }
      if (result.conflict) {
        sendJson(res, 409, { rev: result.rev, snapshot: result.snapshot });
        return;
      }
      sendJson(res, 400, { error: result.error ?? "Rejected." });
      return;
    }

    res.statusCode = 405;
    res.end();
  };
}
