import { describe, expect, it } from "vitest";
import {
  HISTORY_EMPTY,
  HISTORY_NONE,
  TICKETS_EMPTY_CONTEXT,
  TICKETS_PAID_HINT,
  TICKETS_PAID_NONE,
  receiptWhen,
} from "./ticketsCopy";

describe("tickets History leftover copy", () => {
  it("sends reprints to History, not tonight’s Paid pile", () => {
    expect(TICKETS_PAID_HINT).toMatch(/History/);
    expect(TICKETS_PAID_HINT).toMatch(/Tonight/);
    expect(TICKETS_EMPTY_CONTEXT).toMatch(/History/);
    expect(TICKETS_PAID_NONE).toMatch(/tonight/i);
  });

  it("says History receipts survive end of night", () => {
    expect(HISTORY_EMPTY).toMatch(/end of night/i);
    expect(HISTORY_NONE).toMatch(/stay here/i);
  });

  it("stamps a receipt with day and clock", () => {
    const at = new Date(2026, 8, 8, 14, 5, 0).getTime();
    const stamp = receiptWhen({ at });
    expect(stamp).toMatch(/8/);
    expect(stamp).toMatch(/Sep/i);
    expect(stamp).toMatch(/2:05pm/);
    expect(receiptWhen({})).toBe("");
  });
});
