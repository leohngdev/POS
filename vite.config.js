import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "node:path";
import { createFileSnapshotStore, snapshotMiddleware } from "./src/services/snapshotApi.js";

function venueSnapshot() {
  const store = createFileSnapshotStore(resolve(process.cwd(), ".pos-snapshot.json"));
  const middleware = snapshotMiddleware(store);
  return {
    name: "pos-snapshot-api",
    configureServer(server) {
      server.middlewares.use(middleware);
    },
    configurePreviewServer(server) {
      server.middlewares.use(middleware);
    },
  };
}

export default defineConfig({
  plugins: [react(), venueSnapshot()],
  test: {
    environment: "node",
  },
});
