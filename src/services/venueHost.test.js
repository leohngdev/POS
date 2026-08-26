import { execFileSync } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { safeDistFile } from "./venueHost.js";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../..");

const dist = resolve("/tmp/pos-dist");

describe("venue host static paths", () => {
  it("maps / to index.html inside dist", () => {
    expect(safeDistFile(dist, "/")).toBe(resolve(dist, "index.html"));
  });

  it("refuses path traversal", () => {
    expect(safeDistFile(dist, "/../../etc/passwd")).toBe(null);
  });

  it("keeps asset paths under dist", () => {
    const file = safeDistFile(dist, "/assets/app.js");
    expect(file).toBe(resolve(dist, "assets/app.js"));
  });

  it("loads under Node ESM without Vite resolving imports", () => {
    execFileSync(process.execPath, ["--input-type=module", "-e", "await import('./src/services/venueHost.js')"], {
      cwd: repoRoot,
      encoding: "utf8",
    });
  });
});
