import { createServer } from "node:http";
import { existsSync, readFileSync, statSync } from "node:fs";
import { extname, join, resolve } from "node:path";
import { createFileSnapshotStore, snapshotMiddleware } from "./snapshotApi.js";

const MIME = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".png": "image/png",
  ".woff2": "font/woff2",
};

export function safeDistFile(distDir, urlPath) {
  const raw = (urlPath ?? "/").split("?")[0];
  let decoded;
  try {
    decoded = decodeURIComponent(raw);
  } catch {
    return null;
  }
  const rel = decoded === "/" ? "index.html" : decoded.replace(/^\/+/, "");
  const full = resolve(distDir, rel);
  const root = resolve(distDir);
  if (full !== root && !full.startsWith(`${root}\\`) && !full.startsWith(`${root}/`)) return null;
  return full;
}

function sendFile(res, filePath) {
  const body = readFileSync(filePath);
  res.statusCode = 200;
  res.setHeader("Content-Type", MIME[extname(filePath)] ?? "application/octet-stream");
  res.end(body);
}

export function createVenueServer({ distDir, snapshotPath }) {
  const store = createFileSnapshotStore(snapshotPath);
  const api = snapshotMiddleware(store);
  const index = join(distDir, "index.html");

  return createServer((req, res) => {
    api(req, res, () => {
      const target = safeDistFile(distDir, req.url);
      if (target && existsSync(target) && statSync(target).isFile()) {
        sendFile(res, target);
        return;
      }
      if (existsSync(index)) {
        sendFile(res, index);
        return;
      }
      res.statusCode = 404;
      res.end("Build the till first: npm run build");
    });
  });
}
