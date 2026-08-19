import { describe, expect, it } from "vitest";
import {
  activeChits,
  bumpChit,
  claimTable,
  compactLines,
  createInitialState,
  openCheckForTable,
  payCheck,
  rejectClaim,
  releaseClaim,
  send,
} from "./pos";
import { VENUE } from "./venue";
import { fromSnapshot, toSnapshot } from "./persist";

const wagyu = compactLines({ wagyu: 2 }, VENUE.menu);
const kimchi = compactLines({ kimchi: 1 }, VENUE.menu);

function guestSend(state, tableId, lines, now) {
  const claimed = state.guestClaims?.[tableId]
    ? { state }
    : claimTable(state, tableId, VENUE.tables, now);
  return send({
    state: claimed.state,
    venue: VENUE,
    channel: "dine-in",
    tableId,
    lines,
    now,
    requireClaim: true,
  });
}

function staffSend(state, tableId, lines, now) {
  return send({
    state,
    venue: VENUE,
    channel: "dine-in",
    tableId,
    lines,
    now,
  });
}

describe("Sprint 3 guest channel", () => {
  it("guest Send after claim creates a guest chit on the same check model", () => {
    const result = guestSend(createInitialState(), "04", wagyu, 1);
    expect(result.ok).toBe(true);
    expect(result.state.chits[0].source).toBe("guest");
    expect(result.state.chits[0].more).toBe(false);
    expect(openCheckForTable(result.state.checks, "04").tableId).toBe("04");
  });

  it("guest follow-up Send is MORE on the same check", () => {
    const first = guestSend(createInitialState(), "04", wagyu, 1);
    const second = guestSend(first.state, "04", kimchi, 2);
    expect(second.state.checks).toHaveLength(1);
    expect(second.state.chits).toHaveLength(2);
    expect(second.state.chits[1].more).toBe(true);
    expect(second.state.chits[1].source).toBe("guest");
  });

  it("voids kitchen and FOH tickets when floor rejects after a guest order", () => {
    const ordered = guestSend(createInitialState(), "04", wagyu, 1);
    const rejected = rejectClaim(ordered.state, "04");
    expect(rejected.state.guestClaims["04"]).toBeUndefined();
    expect(rejected.state.checks).toHaveLength(0);
    expect(rejected.state.chits).toHaveLength(0);
    expect(activeChits(rejected.state)).toHaveLength(0);
  });

  it("voids both guest Sends on that table, including MORE", () => {
    const first = guestSend(createInitialState(), "04", wagyu, 1);
    const second = guestSend(first.state, "04", kimchi, 2);
    const rejected = rejectClaim(second.state, "04");
    expect(rejected.state.checks).toHaveLength(0);
    expect(rejected.state.chits).toHaveLength(0);
  });

  it("voids an unpaid guest ticket even after kitchen bumped it", () => {
    const ordered = guestSend(createInitialState(), "04", wagyu, 1);
    const bumped = bumpChit(ordered.state, ordered.state.chits[0].id, 5);
    const rejected = rejectClaim(bumped.state, "04");
    expect(rejected.state.checks).toHaveLength(0);
    expect(rejected.state.chits).toHaveLength(0);
    expect(rejected.state.lastBumpedChitId).toBe(null);
  });

  it("keeps staff lines and staff chits when rejecting a guest MORE", () => {
    const staff = staffSend(createInitialState(), "04", wagyu, 1);
    const guest = guestSend(staff.state, "04", kimchi, 2);
    const rejected = rejectClaim(guest.state, "04");
    expect(rejected.state.checks).toHaveLength(1);
    expect(rejected.state.checks[0].lines).toEqual(wagyu);
    expect(rejected.state.chits).toHaveLength(1);
    expect(rejected.state.chits[0].source).toBe("staff");
    expect(activeChits(rejected.state)).toHaveLength(1);
  });

  it("does not void a paid guest check", () => {
    const ordered = guestSend(createInitialState(), "04", wagyu, 1);
    const paid = payCheck(ordered.state, ordered.state.checks[0].id, "card");
    const rejected = rejectClaim(paid.state, "04");
    expect(rejected.state.checks).toHaveLength(1);
    expect(rejected.state.checks[0].status).toBe("paid");
    expect(rejected.state.chits).toHaveLength(1);
    expect(rejected.state.guestClaims["04"]).toBeUndefined();
  });

  it("guest Change table (release) does not void tickets", () => {
    const ordered = guestSend(createInitialState(), "04", wagyu, 1);
    const released = releaseClaim(ordered.state, "04");
    expect(released.state.checks).toHaveLength(1);
    expect(released.state.chits).toHaveLength(1);
    expect(released.state.guestClaims["04"]).toBeUndefined();
  });

  it("blocks guest Send after reject until they claim again", () => {
    const ordered = guestSend(createInitialState(), "04", wagyu, 1);
    const rejected = rejectClaim(ordered.state, "04");
    const blocked = send({
      state: rejected.state,
      venue: VENUE,
      channel: "dine-in",
      tableId: "04",
      lines: wagyu,
      now: 3,
      requireClaim: true,
    });
    expect(blocked.ok).toBe(false);
    expect(blocked.state.chits).toHaveLength(0);
  });

  it("new claim after reject can Send a fresh ticket", () => {
    const ordered = guestSend(createInitialState(), "04", wagyu, 1);
    const rejected = rejectClaim(ordered.state, "04");
    const again = guestSend(rejected.state, "04", kimchi, 8);
    expect(again.ok).toBe(true);
    expect(again.state.checks).toHaveLength(1);
    expect(again.state.chits[0].source).toBe("guest");
    expect(again.state.chits[0].more).toBe(false);
    expect(again.state.guestClaims["04"].at).toBe(8);
  });

  it("staff can still Send on the table after a voiding reject", () => {
    const ordered = guestSend(createInitialState(), "04", wagyu, 1);
    const rejected = rejectClaim(ordered.state, "04");
    const staff = staffSend(rejected.state, "04", kimchi, 9);
    expect(staff.ok).toBe(true);
    expect(staff.state.chits[0].source).toBe("staff");
  });

  it("does not touch takeaway when rejecting a dine-in claim", () => {
    const takeaway = send({
      state: createInitialState(),
      venue: VENUE,
      channel: "takeaway",
      queueNumber: "T-01",
      guestName: "Sarah",
      lines: wagyu,
      now: 1,
    });
    const guest = guestSend(takeaway.state, "04", kimchi, 2);
    const rejected = rejectClaim(guest.state, "04");
    expect(rejected.state.checks).toHaveLength(1);
    expect(rejected.state.checks[0].queueNumber).toBe("T-01");
    expect(rejected.state.chits).toHaveLength(1);
  });

  it("persists a voided guest order as empty table state", () => {
    const ordered = guestSend(createInitialState(), "04", wagyu, 1);
    const rejected = rejectClaim(ordered.state, "04");
    const loaded = fromSnapshot(toSnapshot(rejected.state), createInitialState());
    expect(loaded.checks).toHaveLength(0);
    expect(loaded.chits).toHaveLength(0);
    expect(loaded.guestClaims["04"]).toBeUndefined();
  });
});
