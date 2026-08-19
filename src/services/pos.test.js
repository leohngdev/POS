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
  checkTotal,
  updateVenueTaxes,
  clampRate,
  normalizeTableId,
  claimTable,
  rejectClaim,
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

describe("Venue tax", () => {
  const check = { lines };

  it("leaves total at subtotal when GST and surcharge are off", () => {
    expect(checkTotal(check, createInitialState().venue)).toBe(24);
  });

  it("adds GST when enabled", () => {
    const venue = updateVenueTaxes(createInitialState(), { gstEnabled: true, gstRate: 0.1 }).venue;
    expect(checkTotal(check, venue)).toBe(26.4);
  });

  it("ignores NaN rates", () => {
    expect(clampRate(Number("nope"), 0.1)).toBe(0.1);
  });
});

describe("Guest claim", () => {
  it("normalizes typed and QR table ids to venue tables", () => {
    expect(normalizeTableId("4", VENUE.tables)).toBe("04");
    expect(normalizeTableId("04", VENUE.tables)).toBe("04");
    expect(normalizeTableId("004", VENUE.tables)).toBe("04");
    expect(normalizeTableId("99", VENUE.tables)).toBe(null);
    expect(normalizeTableId("nope", VENUE.tables)).toBe(null);
  });

  it("claims and rejects a table", () => {
    const claimed = claimTable(createInitialState(), "04", VENUE.tables, 9);
    expect(claimed.ok).toBe(true);
    expect(claimed.state.guestClaims["04"].at).toBe(9);
    const rejected = rejectClaim(claimed.state, "04");
    expect(rejected.state.guestClaims["04"]).toBeUndefined();
  });

  it("guest Send on an open table check fires MORE", () => {
    const staff = send({
      state: createInitialState(),
      venue: VENUE,
      channel: "dine-in",
      tableId: "04",
      lines,
      now: 1,
    });
    const claimed = claimTable(staff.state, "04", VENUE.tables, 2);
    const guest = send({
      state: claimed.state,
      venue: VENUE,
      channel: "dine-in",
      tableId: "04",
      lines: compactLines({ kimchi: 1 }, VENUE.menu),
      now: 2,
      requireClaim: true,
    });
    expect(guest.state.checks).toHaveLength(1);
    expect(guest.state.chits[1].more).toBe(true);
    expect(guest.state.chits[1].source).toBe("guest");
  });

  it("blocks a guest Send after the floor rejects the claim", () => {
    const claimed = claimTable(createInitialState(), "04", VENUE.tables, 1);
    const rejected = rejectClaim(claimed.state, "04");
    const guest = send({
      state: rejected.state,
      venue: VENUE,
      channel: "dine-in",
      tableId: "04",
      lines,
      now: 2,
      requireClaim: true,
    });
    expect(guest.ok).toBe(false);
    expect(guest.state.chits).toHaveLength(0);
  });

  it("lets staff Send after a reject without a guest claim", () => {
    const claimed = claimTable(createInitialState(), "04", VENUE.tables, 1);
    const rejected = rejectClaim(claimed.state, "04");
    const staff = send({
      state: rejected.state,
      venue: VENUE,
      channel: "dine-in",
      tableId: "04",
      lines,
      now: 2,
    });
    expect(staff.ok).toBe(true);
    expect(staff.state.chits).toHaveLength(1);
  });

  it("lets a guest Send again after they re-claim", () => {
    const claimed = claimTable(createInitialState(), "04", VENUE.tables, 1);
    const rejected = rejectClaim(claimed.state, "04");
    const again = claimTable(rejected.state, "04", VENUE.tables, 3);
    const guest = send({
      state: again.state,
      venue: VENUE,
      channel: "dine-in",
      tableId: "04",
      lines,
      now: 4,
      requireClaim: true,
    });
    expect(guest.ok).toBe(true);
    expect(again.state.guestClaims["04"].at).toBe(3);
  });
});
