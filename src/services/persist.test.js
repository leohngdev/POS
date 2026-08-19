import { describe, expect, it } from "vitest";
import { createInitialState, send, compactLines, claimTable } from "./pos";
import { VENUE } from "./venue";
import { fromSnapshot, loadState, toSnapshot, writeStore, STORAGE_KEY } from "./persist";

const lines = compactLines({ wagyu: 1 }, VENUE.menu);

function memoryStorage() {
  const data = {};
  return {
    getItem(key) {
      return Object.hasOwn(data, key) ? data[key] : null;
    },
    setItem(key, value) {
      data[key] = String(value);
    },
  };
}

describe("persist", () => {
  it("round-trips checks and MORE chits without unlocking", () => {
    const first = send({
      state: createInitialState(),
      venue: VENUE,
      channel: "dine-in",
      tableId: "04",
      lines,
      now: 1,
    });
    const second = send({
      state: first.state,
      venue: VENUE,
      channel: "dine-in",
      tableId: "04",
      lines,
      now: 2,
    });
    const snap = toSnapshot({ ...second.state, unlocked: true });
    expect(snap.schema).toBe(1);
    const loaded = fromSnapshot(snap, createInitialState());
    expect(loaded.unlocked).toBe(false);
    expect(loaded.checks).toHaveLength(1);
    expect(loaded.chits[1].more).toBe(true);
  });

  it("starts empty on corrupt JSON", () => {
    const storage = memoryStorage();
    storage.setItem(STORAGE_KEY, "{not json");
    const loaded = loadState(createInitialState(), storage);
    expect(loaded.checks).toHaveLength(0);
  });

  it("writes and reads through a storage fake", () => {
    const storage = memoryStorage();
    const sent = send({
      state: createInitialState(),
      venue: VENUE,
      channel: "takeaway",
      queueNumber: "T-01",
      guestName: null,
      lines,
      now: 1,
    });
    writeStore(sent.state, storage);
    const loaded = loadState(createInitialState(), storage);
    expect(loaded.checks[0].queueNumber).toBe("T-01");
  });

  it("keeps guest claims on schema 1", () => {
    const claimed = {
      ...createInitialState(),
      guestClaims: { "04": { at: 12 } },
    };
    const snap = toSnapshot(claimed);
    expect(snap.guestClaims["04"].at).toBe(12);
    const loaded = fromSnapshot(snap, createInitialState());
    expect(loaded.guestClaims["04"].at).toBe(12);
  });

  it("round-trips guest chit source", () => {
    const claimed = claimTable(createInitialState(), "04", VENUE.tables, 1);
    const sent = send({
      state: claimed.state,
      venue: VENUE,
      channel: "dine-in",
      tableId: "04",
      lines,
      now: 2,
      requireClaim: true,
    });
    const loaded = fromSnapshot(toSnapshot(sent.state), createInitialState());
    expect(loaded.chits[0].source).toBe("guest");
  });
});
