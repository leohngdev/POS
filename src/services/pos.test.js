import { describe, expect, it } from "vitest";
import {
  compactLines,
  createInitialState,
  send,
  payCheck,
  bumpChit,
  undoLastBump,
  activeChits,
  openCheckForTable,
  checkFloorStatus,
  verifyPin,
} from "./pos";
import { VENUE } from "./venue";

const lines = compactLines({ wagyu: 2 }, VENUE.menu);

describe("PIN", () => {
  it("accepts the venue PIN and rejects others", () => {
    expect(verifyPin("1234", VENUE)).toBe(true);
    expect(verifyPin("0000", VENUE)).toBe(false);
  });
});

describe("Send", () => {
  it("refuses an empty Send", () => {
    const state = createInitialState();
    const result = send({
      state,
      venue: VENUE,
      channel: "dine-in",
      tableId: "04",
      lines: [],
      now: 1,
    });
    expect(result.ok).toBe(false);
    expect(result.state.chits).toHaveLength(0);
  });

  it("creates a check and a chit that is not MORE", () => {
    const result = send({
      state: createInitialState(),
      venue: VENUE,
      channel: "dine-in",
      tableId: "04",
      lines,
      now: 1,
    });
    expect(result.ok).toBe(true);
    expect(result.state.checks).toHaveLength(1);
    expect(result.state.chits[0].more).toBe(false);
    expect(openCheckForTable(result.state.checks, "04").lines[0].qty).toBe(2);
  });

  it("appends the same table check and fires a MORE chit", () => {
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
      lines: compactLines({ kimchi: 3 }, VENUE.menu),
      now: 2,
    });
    expect(second.state.checks).toHaveLength(1);
    expect(second.state.chits).toHaveLength(2);
    expect(second.state.chits[1].more).toBe(true);
    expect(second.state.chits[1].lines[0].name).toBe("Kimchi");
    expect(second.state.chits[0].lines.some((l) => l.itemId === "kimchi")).toBe(false);
  });

  it("opens a new check after the table is paid", () => {
    const ordered = send({
      state: createInitialState(),
      venue: VENUE,
      channel: "dine-in",
      tableId: "04",
      lines,
      now: 1,
    });
    const paid = payCheck(ordered.state, ordered.state.checks[0].id, "cash");
    const again = send({
      state: paid.state,
      venue: VENUE,
      channel: "dine-in",
      tableId: "04",
      lines,
      now: 3,
    });
    expect(again.state.checks).toHaveLength(2);
    expect(again.state.chits[1].more).toBe(false);
  });
});

describe("Kitchen bump", () => {
  it("removes a chit from the cook list and can undo", () => {
    const ordered = send({
      state: createInitialState(),
      venue: VENUE,
      channel: "takeaway",
      queueNumber: "T-01",
      guestName: "Sarah",
      lines,
      now: 1,
    });
    const bumped = bumpChit(ordered.state, ordered.state.chits[0].id, 5);
    expect(activeChits(bumped.state)).toHaveLength(0);
    const undone = undoLastBump(bumped.state);
    expect(activeChits(undone.state)).toHaveLength(1);
  });

  it("moves FOH from cooking to ready after the last chit is bumped", () => {
    const ordered = send({
      state: createInitialState(),
      venue: VENUE,
      channel: "dine-in",
      tableId: "04",
      lines,
      now: 1,
    });
    const check = ordered.state.checks[0];
    expect(checkFloorStatus(check, ordered.state.chits)).toBe("cooking");
    const bumped = bumpChit(ordered.state, ordered.state.chits[0].id, 5);
    expect(checkFloorStatus(check, bumped.state.chits)).toBe("ready");
    const paid = payCheck(bumped.state, check.id, "card");
    expect(checkFloorStatus(paid.state.checks[0], paid.state.chits)).toBe("paid");
  });
});
