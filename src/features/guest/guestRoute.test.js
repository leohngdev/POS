import { describe, expect, it } from "vitest";
import { parseClockRoute, parseGuestRoute } from "./guestRoute";

describe("parseGuestRoute", () => {
  it("treats #/order as the guest claim screen", () => {
    expect(parseGuestRoute("#/order")).toEqual({ isGuest: true, tableId: null });
  });

  it("reads a QR table shortcut", () => {
    expect(parseGuestRoute("#/order/1a")).toEqual({ isGuest: true, tableId: "1a" });
    expect(parseGuestRoute("#/order/04")).toEqual({ isGuest: true, tableId: "04" });
  });

  it("ignores staff hashes", () => {
    expect(parseGuestRoute("")).toEqual({ isGuest: false, tableId: null });
    expect(parseGuestRoute("#/kitchen")).toEqual({ isGuest: false, tableId: null });
    expect(parseGuestRoute("#/orders")).toEqual({ isGuest: false, tableId: null });
    expect(parseGuestRoute("#/clock")).toEqual({ isGuest: false, tableId: null });
  });

  it("treats #/clock as the staff clock", () => {
    expect(parseClockRoute("#/clock")).toBe(true);
    expect(parseClockRoute("#/order")).toBe(false);
  });
});
