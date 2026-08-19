import { describe, expect, it } from "vitest";
import { createInitialState, send, compactLines } from "./pos";
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
});
