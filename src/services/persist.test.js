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
    expect(snap.guestClaims["04"].status).toBe("pending");
    const loaded = fromSnapshot(snap, createInitialState());
    expect(loaded.guestClaims["04"].at).toBe(12);
    expect(loaded.guestClaims["04"].status).toBe("pending");
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

  it("round-trips accepted claims", () => {
    const claimed = claimTable(createInitialState(), "04", VENUE.tables, 1);
    const seated = {
      ...claimed.state,
      guestClaims: { "04": { at: 1, status: "accepted" } },
    };
    const loaded = fromSnapshot(toSnapshot(seated), createInitialState());
    expect(loaded.guestClaims["04"].status).toBe("accepted");
  });

  it("round-trips live venue config on schema 1", () => {
    const base = createInitialState();
    const custom = {
      ...base,
      venue: {
        ...base.venue,
        name: "Hanok",
        pin: "4321",
        tables: ["01", "02"],
        menu: [{ id: "tea", name: "Barley tea", unitPrice: 3, soldOut: false }],
      },
    };
    const loaded = fromSnapshot(toSnapshot(custom), createInitialState());
    expect(loaded.venue.name).toBe("Hanok");
    expect(loaded.venue.pin).toBe("4321");
    expect(loaded.venue.tables).toEqual(["01", "02"]);
    expect(loaded.venue.menu[0].name).toBe("Barley tea");
  });

  it("keeps default menu when an old snapshot only stored tax flags", () => {
    const raw = {
      schema: 1,
      checks: [],
      chits: [],
      nextCheck: 1,
      nextChit: 1,
      nextTakeaway: 1,
      lastBumpedChitId: null,
      guestClaims: {},
      venue: { gstEnabled: true, gstRate: 0.1, surchargeEnabled: false, surchargeRate: 0.1 },
    };
    const loaded = fromSnapshot(raw, createInitialState());
    expect(loaded.venue.gstEnabled).toBe(true);
    expect(loaded.venue.menu[0].id).toBe("wagyu");
    expect(loaded.venue.pin).toBe("1234");
  });
});
