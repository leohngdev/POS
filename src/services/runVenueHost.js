import { existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { createVenueServer } from "./venueHost.js";

const port = Number(process.env.PORT) || 4173;
const host = process.env.HOST || "0.0.0.0";
const distDir = resolve(process.cwd(), "dist");
const snapshotPath = resolve(process.cwd(), ".pos-snapshot.json");

if (!existsSync(join(distDir, "index.html"))) {
  console.error("No dist/ yet. Run: npm run build && npm start");
  process.exit(1);
}

const server = createVenueServer({ distDir, snapshotPath });
server.listen(port, host, () => {
  console.log(`Venue till on http://localhost:${port}/  (LAN: this machine’s IP, port ${port})`);
});
