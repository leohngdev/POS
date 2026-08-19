import { describe, expect, it } from "vitest";
import {
  applyOnVenue,
  hasLocalService,
  pullSnapshot,
  pushSnapshot,
  sessionize,
} from "./sync";
import { claimTable, compactLines, createInitialState, send } from "./pos";
import { VENUE } from "./venue";
import { toSnapshot } from "./persist";

const wagyu = compactLines({ wagyu: 1 }, VENUE.menu);

function jsonResponse(status, body) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  };
}

describe("venue sync client", () => {
  it("pulls a snapshot", async () => {
    const pulled = await pullSnapshot(async () => jsonResponse(200, { rev: 4, snapshot: toSnapshot(createInitialState()) }));
    expect(pulled.ok).toBe(true);
    expect(pulled.rev).toBe(4);
  });

  it("treats a failed pull as offline", async () => {
    const pulled = await pullSnapshot(async () => {
      throw new Error("down");
    });
    expect(pulled.ok).toBe(false);
  });

  it("returns a conflict on 409", async () => {
    const pushed = await pushSnapshot(1, toSnapshot(createInitialState()), async () =>
      jsonResponse(409, { rev: 2, snapshot: toSnapshot(createInitialState()) })
    );
    expect(pushed.ok).toBe(false);
    expect(pushed.conflict).toBe(true);
    expect(pushed.rev).toBe(2);
  });

  it("sessionize keeps the till unlocked", () => {
    const next = sessionize(toSnapshot(createInitialState()), { unlocked: true, pinError: null });
    expect(next.unlocked).toBe(true);
    expect(next.checks).toEqual([]);
  });

  it("hasLocalService is true when a claim exists", () => {
    const claimed = claimTable(createInitialState(), "04", VENUE.tables, 1).state;
    expect(hasLocalService(claimed)).toBe(true);
    expect(hasLocalService(createInitialState())).toBe(false);
  });

  it("applies a guest Send on the pulled venue snapshot", async () => {
    const claimed = claimTable(createInitialState(), "04", VENUE.tables, 1).state;
    const applied = await applyOnVenue(
      (s) =>
        send({
          state: s,
          venue: VENUE,
          channel: "dine-in",
          tableId: "04",
          lines: wagyu,
          now: 2,
          requireClaim: true,
        }),
      { unlocked: false, pinError: null, rev: 1 },
      createInitialState(),
      {
        pull: async () => ({ ok: true, rev: 1, snapshot: toSnapshot(claimed) }),
        push: async (rev, snapshot) => ({ ok: true, rev: rev + 1, snapshot }),
      }
    );
    expect(applied.result.ok).toBe(true);
    expect(applied.status).toBe("live");
    expect(applied.rev).toBe(2);
    expect(applied.next.chits[0].source).toBe("guest");
  });

  it("retries the mutation when the venue rev moved", async () => {
    const claimed = claimTable(createInitialState(), "04", VENUE.tables, 1).state;
    let pushes = 0;
    const applied = await applyOnVenue(
      (s) =>
        send({
          state: s,
          venue: VENUE,
          channel: "dine-in",
          tableId: "04",
          lines: wagyu,
          now: 2,
          requireClaim: true,
        }),
      { unlocked: false, pinError: null, rev: 1 },
      claimed,
      {
        pull: async () => ({ ok: true, rev: 1, snapshot: toSnapshot(claimed) }),
        push: async (rev, snapshot) => {
          pushes += 1;
          if (pushes === 1) {
            return { ok: false, conflict: true, rev: 2, snapshot: toSnapshot(claimed) };
          }
          expect(rev).toBe(2);
          return { ok: true, rev: 3, snapshot };
        },
      }
    );
    expect(applied.result.ok).toBe(true);
    expect(applied.rev).toBe(3);
    expect(applied.next.chits).toHaveLength(1);
  });

  it("keeps a successful local Send when the API is down", async () => {
    const claimed = claimTable(createInitialState(), "04", VENUE.tables, 1).state;
    const applied = await applyOnVenue(
      (s) =>
        send({
          state: s,
          venue: VENUE,
          channel: "dine-in",
          tableId: "04",
          lines: wagyu,
          now: 2,
          requireClaim: true,
        }),
      { unlocked: false, pinError: null, rev: 0 },
      claimed,
      {
        pull: async () => ({ ok: false, error: "offline" }),
        push: async () => ({ ok: false, conflict: false, error: "offline" }),
      }
    );
    expect(applied.result.ok).toBe(true);
    expect(applied.status).toBe("local");
    expect(applied.next.chits).toHaveLength(1);
  });
});
