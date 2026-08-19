import { describe, expect, it } from "vitest";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createSnapshotStore } from "./snapshotStore";
import { createFileSnapshotStore } from "./snapshotApi";
import { createInitialState, send, compactLines } from "./pos";
import { VENUE } from "./venue";
import { toSnapshot } from "./persist";

const lines = compactLines({ wagyu: 1 }, VENUE.menu);

describe("snapshot store", () => {
  it("starts empty at rev 0", () => {
    const store = createSnapshotStore();
    expect(store.get()).toEqual({ rev: 0, snapshot: null });
  });

  it("accepts a put at the current rev and bumps it", () => {
    const store = createSnapshotStore();
    const sent = send({
      state: createInitialState(),
      venue: VENUE,
      channel: "dine-in",
      tableId: "04",
      lines,
      now: 1,
    });
    const snap = toSnapshot(sent.state);
    const put = store.put(0, snap);
    expect(put.ok).toBe(true);
    expect(put.rev).toBe(1);
    expect(put.snapshot.checks).toHaveLength(1);
    expect(store.get().rev).toBe(1);
  });

  it("rejects a stale rev so the other device can retry", () => {
    const store = createSnapshotStore();
    const snap = toSnapshot(createInitialState());
    store.put(0, snap);
    const stale = store.put(0, snap);
    expect(stale.ok).toBe(false);
    expect(stale.conflict).toBe(true);
    expect(stale.rev).toBe(1);
  });

  it("rejects a body that is not a schema-1 snapshot", () => {
    const store = createSnapshotStore();
    const bad = store.put(0, { schema: 1 });
    expect(bad.ok).toBe(false);
    expect(bad.conflict).toBe(false);
  });

  it("writes a successful put to disk", () => {
    const dir = mkdtempSync(join(tmpdir(), "pos-snap-"));
    const file = join(dir, "snap.json");
    const store = createFileSnapshotStore(file);
    const snap = toSnapshot(createInitialState());
    store.put(0, snap);
    const saved = JSON.parse(readFileSync(file, "utf8"));
    expect(saved.rev).toBe(1);
    const again = createFileSnapshotStore(file);
    expect(again.get().rev).toBe(1);
  });
});
