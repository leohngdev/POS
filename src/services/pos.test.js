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
  tableFloorStatus,
  verifyPin,
  checkTotal,
  checkDiscount,
  amountDue,
  updateVenueTaxes,
  clampRate,
  normalizeTableId,
  claimTable,
  rejectClaim,
  acceptClaim,
  tableClaimStatus,
  pendingGuestTables,
  moveTable,
  moveTargets,
  voidLastSend,
  canVoidLastSend,
  checkLabel,
  patchMenuItem,
  addMenuItem,
  setTableCount,
  addTable,
  removeTable,
  setPin,
  orderableMenu,
  nightReport,
  endNight,
  applyCheckOffer,
  addOffer,
  liveTables,
  renameTable,
  addZone,
  addBooking,
  seatBooking,
  reorderTable,
  partyOnTable,
  partyTag,
  addStockItem,
  setStockCount,
  toBuy,
  receiveStock,
  placeStockOrder,
  receiveOrderLine,
  addStockGroup,
  removeStockGroup,
  stockCategories,
  addStaff,
  matchUnlock,
  toggleShift,
  rosterOn,
  clockIn,
  clockOut,
  punchIn,
  punchOut,
  openClock,
  whoIsClocked,
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
    expect(tableFloorStatus(paid.state, "04")).toBe("empty");
  });

  it("marks a table cooking then ready on the floor", () => {
    expect(tableFloorStatus(createInitialState(), "04")).toBe("empty");
    const ordered = send({
      state: createInitialState(),
      venue: VENUE,
      channel: "dine-in",
      tableId: "04",
      lines,
      now: 1,
    });
    expect(tableFloorStatus(ordered.state, "04")).toBe("cooking");
    const bumped = bumpChit(ordered.state, ordered.state.chits[0].id, 5);
    expect(tableFloorStatus(bumped.state, "04")).toBe("ready");
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
    expect(normalizeTableId("1a", ["1a", "1b"])).toBe("1a");
    expect(normalizeTableId("1A", ["1a", "1b"])).toBe("1a");
  });

  it("claims pending, accepts to seat, and keeps a refresh seated", () => {
    const claimed = claimTable(createInitialState(), "04", VENUE.tables, 9);
    expect(claimed.ok).toBe(true);
    expect(claimed.state.guestClaims["04"].at).toBe(9);
    expect(tableClaimStatus(claimed.state, "04")).toBe("pending");
    const seated = acceptClaim(claimed.state, "04");
    expect(tableClaimStatus(seated.state, "04")).toBe("accepted");
    const again = claimTable(seated.state, "04", VENUE.tables, 11);
    expect(tableClaimStatus(again.state, "04")).toBe("accepted");
    expect(again.state.guestClaims["04"].at).toBe(11);
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

  it("guest Send leaves the claim pending", () => {
    const claimed = claimTable(createInitialState(), "04", VENUE.tables, 1);
    const guest = send({
      state: claimed.state,
      venue: VENUE,
      channel: "dine-in",
      tableId: "04",
      lines,
      now: 2,
      requireClaim: true,
    });
    expect(guest.ok).toBe(true);
    expect(tableClaimStatus(guest.state, "04")).toBe("pending");
  });

  it("staff Send on a pulsing table seats the guest", () => {
    const claimed = claimTable(createInitialState(), "04", VENUE.tables, 1);
    const staff = send({
      state: claimed.state,
      venue: VENUE,
      channel: "dine-in",
      tableId: "04",
      lines,
      now: 2,
    });
    expect(staff.ok).toBe(true);
    expect(tableClaimStatus(staff.state, "04")).toBe("accepted");
  });

  it("staff Send on an empty table does not invent a claim", () => {
    const staff = send({
      state: createInitialState(),
      venue: VENUE,
      channel: "dine-in",
      tableId: "04",
      lines,
      now: 1,
    });
    expect(tableClaimStatus(staff.state, "04")).toBe(null);
  });

  it("accept with no claim is refused", () => {
    const result = acceptClaim(createInitialState(), "04");
    expect(result.ok).toBe(false);
    expect(pendingGuestTables(result.state, VENUE.tables)).toEqual([]);
  });

  it("treats a legacy claim without status as pending", () => {
    const legacy = { ...createInitialState(), guestClaims: { "04": { at: 1 } } };
    expect(tableClaimStatus(legacy, "04")).toBe("pending");
    expect(pendingGuestTables(legacy, VENUE.tables)).toEqual(["04"]);
  });
});

describe("Move table and void last Send", () => {
  it("moves an open check and its claim to a free table", () => {
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
    const moved = moveTable(sent.state, "04", "06", VENUE.tables);
    expect(moved.ok).toBe(true);
    expect(openCheckForTable(moved.state.checks, "04")).toBe(null);
    expect(openCheckForTable(moved.state.checks, "06").id).toBe("CHK-1");
    expect(tableClaimStatus(moved.state, "04")).toBe(null);
    expect(tableClaimStatus(moved.state, "06")).toBe("pending");
    expect(checkLabel(openCheckForTable(moved.state.checks, "06"))).toBe("Table 06");
    expect(moved.state.chits[0].checkId).toBe("CHK-1");
  });

  it("moves a claim with no order yet", () => {
    const claimed = claimTable(createInitialState(), "04", VENUE.tables, 1);
    const moved = moveTable(claimed.state, "04", "08", VENUE.tables);
    expect(tableClaimStatus(moved.state, "08")).toBe("pending");
    expect(tableClaimStatus(moved.state, "04")).toBe(null);
  });

  it("merges onto a table that already has an open check", () => {
    const a = send({
      state: createInitialState(),
      venue: VENUE,
      channel: "dine-in",
      tableId: "04",
      lines,
      now: 1,
    });
    const b = send({
      state: a.state,
      venue: VENUE,
      channel: "dine-in",
      tableId: "05",
      lines: compactLines({ kimchi: 1 }, VENUE.menu),
      now: 2,
    });
    const moved = moveTable(b.state, "04", "05", VENUE.tables);
    expect(moved.ok).toBe(true);
    expect(openCheckForTable(moved.state.checks, "04")).toBe(null);
    const dest = openCheckForTable(moved.state.checks, "05");
    expect(dest.id).toBe("CHK-2");
    expect(dest.lines.map((l) => l.itemId).sort()).toEqual(["kimchi", "wagyu"]);
    expect(moved.state.chits).toHaveLength(2);
    expect(moved.state.chits.every((c) => c.checkId === dest.id)).toBe(true);
    expect(moved.state.chits.find((c) => c.id === "CHIT-1").more).toBe(true);
    expect(checkLabel(dest)).toBe("Table 05");
  });

  it("keeps the destination guest when merging onto a claimed table", () => {
    const claimed = claimTable(createInitialState(), "05", VENUE.tables, 1);
    const dest = send({
      state: claimed.state,
      venue: VENUE,
      channel: "dine-in",
      tableId: "05",
      lines: compactLines({ kimchi: 1 }, VENUE.menu),
      now: 2,
      requireClaim: true,
    });
    const source = send({
      state: dest.state,
      venue: VENUE,
      channel: "dine-in",
      tableId: "04",
      lines,
      now: 3,
    });
    const moved = moveTable(source.state, "04", "05", VENUE.tables);
    expect(tableClaimStatus(moved.state, "05")).toBe("pending");
    expect(tableClaimStatus(moved.state, "04")).toBe(null);
    expect(openCheckForTable(moved.state.checks, "05").lines).toHaveLength(2);
  });

  it("lists every other table as a move target", () => {
    const claimed = claimTable(createInitialState(), "05", VENUE.tables, 1);
    const sent = send({
      state: claimed.state,
      venue: VENUE,
      channel: "dine-in",
      tableId: "04",
      lines,
      now: 2,
    });
    expect(moveTargets(sent.state, VENUE.tables, "04")).toEqual(["01", "02", "03", "05", "06", "07", "08"]);
  });

  it("voids the last unbumped Send and keeps earlier lines", () => {
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
      lines: compactLines({ kimchi: 1 }, VENUE.menu),
      now: 2,
    });
    expect(canVoidLastSend(second.state, "CHK-1")).toBe(true);
    const voided = voidLastSend(second.state, "CHK-1");
    expect(voided.ok).toBe(true);
    expect(voided.state.chits).toHaveLength(1);
    expect(voided.state.checks[0].lines).toEqual(lines);
  });

  it("drops the check when the only Send is voided", () => {
    const sent = send({
      state: createInitialState(),
      venue: VENUE,
      channel: "dine-in",
      tableId: "04",
      lines,
      now: 1,
    });
    const voided = voidLastSend(sent.state, "CHK-1");
    expect(voided.state.checks).toHaveLength(0);
    expect(voided.state.chits).toHaveLength(0);
  });

  it("refuses to void after kitchen bumped that Send", () => {
    const sent = send({
      state: createInitialState(),
      venue: VENUE,
      channel: "dine-in",
      tableId: "04",
      lines,
      now: 1,
    });
    const bumped = bumpChit(sent.state, sent.state.chits[0].id, 3);
    const voided = voidLastSend(bumped.state, "CHK-1");
    expect(voided.ok).toBe(false);
    expect(bumped.state.chits).toHaveLength(1);
  });
});

describe("Line notes, discount, tender, venue config", () => {
  it("keeps the same dish with different notes as separate lines", () => {
    const noted = compactLines({ kimchi: 1 }, VENUE.menu, { kimchi: "no spice" });
    const first = send({
      state: createInitialState(),
      venue: VENUE,
      channel: "dine-in",
      tableId: "04",
      lines: compactLines({ kimchi: 1 }, VENUE.menu),
      now: 1,
    });
    const second = send({
      state: first.state,
      venue: VENUE,
      channel: "dine-in",
      tableId: "04",
      lines: noted,
      now: 2,
    });
    expect(second.state.checks[0].lines).toHaveLength(2);
    expect(second.state.chits[1].lines[0].note).toBe("no spice");
  });

  it("takes covers on first Send and discounts the net before GST", () => {
    const sent = send({
      state: createInitialState(),
      venue: VENUE,
      channel: "dine-in",
      tableId: "04",
      lines,
      covers: 3,
      discountRate: 0.1,
      now: 1,
    });
    const check = sent.state.checks[0];
    expect(check.covers).toBe(3);
    expect(checkLabel(check)).toBe("Table 04 · 3");
    expect(checkDiscount(check)).toBe(2.4);
    const taxed = updateVenueTaxes(sent.state, { gstEnabled: true, gstRate: 0.1 });
    expect(checkTotal(check, taxed.venue)).toBe(23.76);
  });

  it("tenders a partial then closes on the rest as split", () => {
    const sent = send({
      state: createInitialState(),
      venue: VENUE,
      channel: "dine-in",
      tableId: "04",
      lines,
      now: 1,
    });
    const part = payCheck(sent.state, "CHK-1", "card", 10);
    expect(part.ok).toBe(true);
    expect(part.state.checks[0].status).toBe("open");
    expect(amountDue(part.state.checks[0], part.state.venue)).toBe(14);
    const done = payCheck(part.state, "CHK-1", "cash");
    expect(done.state.checks[0].status).toBe("paid");
    expect(done.state.checks[0].paidVia).toBe("split");
    expect(done.state.checks[0].payments).toHaveLength(2);
  });

  it("refuses a tender over remaining", () => {
    const sent = send({
      state: createInitialState(),
      venue: VENUE,
      channel: "dine-in",
      tableId: "04",
      lines,
      now: 1,
    });
    const over = payCheck(sent.state, "CHK-1", "cash", 100);
    expect(over.ok).toBe(false);
    expect(sent.state.checks[0].status).toBe("open");
  });

  it("86 hides a dish from the orderable menu but keeps it on a check", () => {
    const sent = send({
      state: createInitialState(),
      venue: VENUE,
      channel: "dine-in",
      tableId: "04",
      lines,
      now: 1,
    });
    const eightySixed = patchMenuItem(sent.state, "wagyu", { soldOut: true });
    expect(orderableMenu(eightySixed.state.venue.menu).some((i) => i.id === "wagyu")).toBe(false);
    expect(sent.state.checks[0].lines[0].itemId).toBe("wagyu");
  });

  it("adds a dish and refuses shrinking the floor onto an open table", () => {
    const added = addMenuItem(createInitialState(), { name: "Banchan", unitPrice: 4 });
    expect(added.state.venue.menu.at(-1).name).toBe("Banchan");
    const sent = send({
      state: added.state,
      venue: added.state.venue,
      channel: "dine-in",
      tableId: "08",
      lines: compactLines({ wagyu: 1 }, added.state.venue.menu),
      now: 1,
    });
    const shrink = setTableCount(sent.state, 6);
    expect(shrink.ok).toBe(false);
    const grow = setTableCount(sent.state, 12);
    expect(grow.ok).toBe(true);
    expect(grow.state.venue.tables).toHaveLength(12);
  });

  it("changes the PIN used at the gate", () => {
    const changed = setPin(createInitialState(), "9999");
    expect(verifyPin("9999", changed.state.venue)).toBe(true);
    expect(verifyPin("1234", changed.state.venue)).toBe(false);
    expect(setPin(createInitialState(), "12").ok).toBe(false);
  });

  it("clears paid tickets at end of night and keeps open service", () => {
    const a = send({
      state: createInitialState(),
      venue: VENUE,
      channel: "dine-in",
      tableId: "04",
      lines,
      covers: 2,
      now: 1,
    });
    const paid = payCheck(a.state, "CHK-1", "card");
    const b = send({
      state: paid.state,
      venue: VENUE,
      channel: "takeaway",
      queueNumber: "T-01",
      guestName: "Sam",
      lines,
      now: 2,
    });
    const report = nightReport(b.state);
    expect(report.paidCount).toBe(1);
    expect(report.openCount).toBe(1);
    expect(report.card).toBe(24);
    expect(report.covers).toBe(2);
    const closed = endNight(b.state);
    expect(closed.state.checks).toHaveLength(1);
    expect(closed.state.checks[0].channel).toBe("takeaway");
    expect(closed.state.chits).toHaveLength(1);
    expect(closed.state.receipts).toHaveLength(1);
    expect(closed.state.guestClaims).toEqual({});
  });

  it("lets a floor skip table 04 and still add 17", () => {
    let state = createInitialState();
    for (const id of ["04", "06", "07", "08"]) {
      state = removeTable(state, id).state;
    }
    const added = addTable(state, "17");
    expect(added.ok).toBe(true);
    expect(liveTables(added.state.venue)).toEqual(["01", "02", "03", "05", "17"]);
    expect(normalizeTableId("17", liveTables(added.state.venue))).toBe("17");
    expect(normalizeTableId("4", liveTables(added.state.venue))).toBe(null);
  });

  it("stacks a dollar coupon after a percent", () => {
    const sent = send({
      state: createInitialState(),
      venue: VENUE,
      channel: "dine-in",
      tableId: "04",
      lines,
      now: 1,
    });
    const withStaff = applyCheckOffer(sent.state, "CHK-1", { id: "staff", name: "Staff", kind: "percent", value: 0.5 });
    const withCoupon = applyCheckOffer(withStaff.state, "CHK-1", { id: "ten", name: "$10 off", kind: "amount", value: 10 });
    expect(checkDiscount(withCoupon.state.checks[0])).toBe(22);
    expect(checkTotal(withCoupon.state.checks[0], withCoupon.state.venue)).toBe(2);
  });

  it("uses Saturday surcharge when the day is Saturday", () => {
    const venue = updateVenueTaxes(createInitialState(), {
      surchargeEnabled: true,
      surchargeByDay: [0, 0, 0, 0, 0, 0, 0.1],
    }).venue;
    const check = { lines };
    const sat = Date.parse("2026-08-29T12:00:00");
    expect(new Date(sat).getDay()).toBe(6);
    expect(checkTotal(check, venue, sat)).toBe(26.4);
    expect(checkTotal(check, venue, Date.parse("2026-08-24T12:00:00"))).toBe(24);
  });

  it("clears a seated claim at end of night", () => {
    const claimed = claimTable(createInitialState(), "04", VENUE.tables, 1);
    const seated = acceptClaim(claimed.state, "04");
    expect(tableClaimStatus(seated.state, "04")).toBe("accepted");
    const closed = endNight(seated.state);
    expect(tableClaimStatus(closed.state, "04")).toBe(null);
  });

  it("writes a receipt when a check is paid", () => {
    const sent = send({
      state: createInitialState(),
      venue: VENUE,
      channel: "dine-in",
      tableId: "04",
      lines,
      now: 1,
    });
    const paid = payCheck(sent.state, "CHK-1", "cash");
    expect(paid.state.receipts[0].id).toBe("CHK-1");
    expect(paid.state.receipts[0].total).toBe(24);
  });
});

describe("Table names", () => {
  it("keeps 1a as 1a and still maps 4 to 04 on the default floor", () => {
    expect(normalizeTableId("4", VENUE.tables)).toBe("04");
    expect(normalizeTableId("1a", VENUE.tables)).toBe(null);
    const added = addTable(createInitialState(), "1a");
    expect(added.ok).toBe(true);
    expect(liveTables(added.state.venue)).toContain("1a");
    expect(normalizeTableId("1A", liveTables(added.state.venue))).toBe("1a");
    expect(normalizeTableId("1", liveTables(added.state.venue))).toBe("01");
    let state = renameTable(createInitialState(), "01", "1a").state;
    state = renameTable(state, "02", "1b").state;
    expect(normalizeTableId("1", liveTables(state.venue))).toBe(null);
    expect(normalizeTableId("1a", liveTables(state.venue))).toBe("1a");
    expect(normalizeTableId("1b", liveTables(state.venue))).toBe("1b");
  });

  it("will not add 4 when 04 already exists", () => {
    const added = addTable(createInitialState(), "4");
    expect(added.ok).toBe(false);
  });

  it("renames 04 to 1a and takes the open check with it", () => {
    const sent = send({
      state: createInitialState(),
      venue: VENUE,
      channel: "dine-in",
      tableId: "04",
      lines,
      now: 1,
    });
    const renamed = renameTable(sent.state, "04", "1a");
    expect(renamed.ok).toBe(true);
    expect(openCheckForTable(renamed.state.checks, "1a")).toBeTruthy();
    expect(openCheckForTable(renamed.state.checks, "04")).toBeNull();
    expect(liveTables(renamed.state.venue)).not.toContain("04");
  });

  it("puts a table in Upstairs without touching downstairs ids", () => {
    const zoned = addZone(createInitialState(), "Upstairs");
    expect(zoned.ok).toBe(true);
    const added = addTable(zoned.state, "10", zoned.state.venue.zones[1].id);
    expect(added.state.venue.tables.find((t) => t.id === "10").zoneId).toBe(zoned.state.venue.zones[1].id);
    expect(liveTables(added.state.venue).slice(0, 8)).toEqual(VENUE.tables);
  });
});

describe("Book", () => {
  const six = Date.parse("2026-08-27T18:00:00");
  const seven = Date.parse("2026-08-27T19:00:00");

  it("holds a table for a name and refuses a clash inside the hold window", () => {
    const first = addBooking(createInitialState(), { name: "Sam", covers: 2, tableId: "04", at: six });
    expect(first.ok).toBe(true);
    const clash = addBooking(first.state, { name: "Lee", covers: 2, tableId: "04", at: six + 30 * 60 * 1000 });
    expect(clash.ok).toBe(false);
    const later = addBooking(first.state, { name: "Lee", covers: 2, tableId: "04", at: seven + 60 * 60 * 1000 });
    expect(later.ok).toBe(true);
  });

  it("seats a booking onto the floor with guests already filled", () => {
    const booked = addBooking(createInitialState(), { name: "Sam", covers: 4, tableId: "1a", at: six });
    expect(booked.ok).toBe(false);
    const withTable = addTable(createInitialState(), "1a");
    const named = addBooking(withTable.state, { name: "Sam", covers: 4, tableId: "1a", at: six });
    const seated = seatBooking(named.state, named.state.bookings[0].id, six);
    expect(tableClaimStatus(seated.state, "1a")).toBe("accepted");
    expect(seated.state.guestClaims["1a"].covers).toBe(4);
    expect(seated.state.guestClaims["1a"].name).toBe("Sam");
    expect(seated.state.bookings[0].status).toBe("seated");
  });

  it("keeps tomorrow’s book after end of night", () => {
    const tomorrow = Date.parse("2026-08-28T18:00:00");
    const booked = addBooking(createInitialState(), { name: "Sam", covers: 2, tableId: "04", at: tomorrow });
    const closed = endNight(booked.state, six);
    expect(closed.state.bookings).toHaveLength(1);
    expect(closed.state.bookings[0].name).toBe("Sam");
    expect(closed.state.guestClaims).toEqual({});
  });

  it("still finds Sam on the table after Seat", () => {
    const withTable = addTable(createInitialState(), "1a");
    const named = addBooking(withTable.state, { name: "Sam", covers: 4, phone: "0400", tableId: "1a", at: six });
    const seated = seatBooking(named.state, named.state.bookings[0].id, six);
    const party = partyOnTable(seated.state, "1a", six);
    expect(party.name).toBe("Sam");
    expect(party.phone).toBe("0400");
    expect(partyTag(seated.state, party).label).toBe("Here");
    const sent = send({
      state: seated.state,
      venue: seated.state.venue,
      channel: "dine-in",
      tableId: "1a",
      lines,
      now: six,
    });
    expect(partyTag(sent.state, partyOnTable(sent.state, "1a")).label).toBe("On the table");
    const paid = payCheck(sent.state, sent.state.checks[0].id, "card");
    expect(partyTag(paid.state, partyOnTable(paid.state, "1a")).label).toBe("Paid");
  });
});

describe("Table order", () => {
  it("inserts 2a after 02 and can move it next to 02 in the list", () => {
    const added = addTable(createInitialState(), "2a", undefined, "02");
    const ids = liveTables(added.state.venue);
    expect(ids[ids.indexOf("02") + 1]).toBe("2a");
    const moved = reorderTable(added.state, "2a", 0);
    expect(liveTables(moved.state.venue)[0]).toBe("2a");
  });
});

describe("Stock", () => {
  it("counts soju, shows what to buy, and receiving fills the shelf", () => {
    const added = addStockItem(createInitialState(), { name: "Soju", unit: "bottle", par: 12, category: "Bar" });
    expect(added.ok).toBe(true);
    const counted = setStockCount(added.state, added.state.venue.stockItems[0].id, 4, 1);
    const buy = toBuy(counted.state, counted.state.venue);
    expect(buy[0].need).toBe(8);
    const inDoor = receiveStock(counted.state, added.state.venue.stockItems[0].id, 8, 2);
    expect(toBuy(inDoor.state, inDoor.state.venue)).toHaveLength(0);
  });

  it("saves an order and ticks a line in", () => {
    const added = addStockItem(createInitialState(), { name: "Kimchi", unit: "tub", par: 6 });
    const id = added.state.venue.stockItems[0].id;
    const counted = setStockCount(added.state, id, 1, 1);
    const ordered = placeStockOrder(counted.state, 2);
    expect(ordered.state.stockOrders[0].lines[0].qty).toBe(5);
    const got = receiveOrderLine(ordered.state, ordered.state.stockOrders[0].id, id, undefined, 3);
    expect(got.state.stockOrders[0].status).toBe("done");
    expect(toBuy(got.state, got.state.venue)).toHaveLength(0);
  });

  it("turns a category into a shelf and unfiles items when that shelf is removed", () => {
    const added = addStockItem(createInitialState(), { name: "Soju", unit: "bottle", par: 12, category: "Bar" });
    expect(stockCategories(added.state.venue)).toEqual(["Bar"]);
    const fridge = addStockGroup(added.state, "Fridge");
    expect(stockCategories(fridge.state.venue)).toEqual(["Bar", "Fridge"]);
    const barId = fridge.state.venue.stockGroups.find((g) => g.name === "Bar").id;
    const gone = removeStockGroup(fridge.state, barId);
    expect(gone.state.venue.stockItems[0].category).toBe("");
    expect(stockCategories(gone.state.venue)).toEqual(["Fridge"]);
  });
});

describe("Roster", () => {
  it("unlocks a named PIN, not the till door, and toggles a dinner shift", () => {
    const maya = addStaff(createInitialState(), { name: "Maya", pin: "2222", role: "floor" });
    expect(maya.ok).toBe(true);
    const id = maya.state.venue.staff[0].id;
    expect(matchUnlock("2222", maya.state.venue, id).name).toBe("Maya");
    expect(matchUnlock("1234", maya.state.venue, "till").id).toBe("till");
    expect(matchUnlock("2222", maya.state.venue, "till")).toBeNull();
    expect(verifyPin("1234", maya.state.venue)).toBe(true);
    expect(addStaff(maya.state, { name: "Jo", pin: "1234" }).ok).toBe(false);
    expect(setPin(maya.state, "2222").ok).toBe(false);
    const on = toggleShift(maya.state, id, 3, "dinner");
    expect(rosterOn(on.state, 3, "dinner")[0].name).toBe("Maya");
    const off = toggleShift(on.state, id, 3, "dinner");
    expect(rosterOn(off.state, 3, "dinner")).toHaveLength(0);
  });

  it("clocks in on unlock and out on lock", () => {
    const who = { id: "maya", name: "Maya", role: "floor" };
    const inNow = clockIn(createInitialState(), who, 10);
    expect(inNow.state.onStaff.name).toBe("Maya");
    expect(inNow.state.clocks[0].inAt).toBe(10);
    const out = clockOut(inNow.state, 20);
    expect(out.state.onStaff).toBeNull();
    expect(out.state.clocks[0].outAt).toBe(20);
  });

  it("punches a person without putting them on this till", () => {
    const maya = addStaff(createInitialState(), { name: "Maya", pin: "2222" });
    const who = maya.state.venue.staff[0];
    const inNow = punchIn(maya.state, who, 10);
    expect(inNow.state.onStaff).toBeNull();
    expect(openClock(inNow.state, who.id).inAt).toBe(10);
    const out = punchOut(inNow.state, who.id, 20);
    expect(out.state.clocks[0].outAt).toBe(20);
    expect(whoIsClocked(out.state, out.state.venue)).toHaveLength(0);
  });
});
