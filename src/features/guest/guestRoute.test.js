import { describe, expect, it } from "vitest";
import { parseGuestRoute } from "./guestRoute";

describe("parseGuestRoute", () => {
  it("treats #/order as the guest claim screen", () => {
    expect(parseGuestRoute("#/order")).toEqual({ isGuest: true, tableId: null });
  });

  it("reads a QR table shortcut", () => {
    expect(parseGuestRoute("#/order/04")).toEqual({ isGuest: true, tableId: "04" });
  });

  it("ignores staff hashes", () => {
    expect(parseGuestRoute("")).toEqual({ isGuest: false, tableId: null });
    expect(parseGuestRoute("#/kitchen")).toEqual({ isGuest: false, tableId: null });
    expect(parseGuestRoute("#/orders")).toEqual({ isGuest: false, tableId: null });
  });
});
