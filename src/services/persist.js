export const STORAGE_KEY = "pos.till.v1";
export const SCHEMA = 1;

function snapshotVenue(venue) {
  if (!venue || typeof venue !== "object") return {};
  const next = {
    gstEnabled: Boolean(venue.gstEnabled),
    gstRate: venue.gstRate,
    surchargeEnabled: Boolean(venue.surchargeEnabled),
    surchargeRate: venue.surchargeRate,
  };
  if (venue.name != null) next.name = venue.name;
  if (venue.pin != null) next.pin = venue.pin;
  if (Array.isArray(venue.tables)) next.tables = venue.tables;
  if (Array.isArray(venue.menu)) next.menu = venue.menu;
  if (Array.isArray(venue.offers)) next.offers = venue.offers;
  if (Array.isArray(venue.surchargeByDay)) next.surchargeByDay = venue.surchargeByDay;
  if (venue.askTakeawayPhone != null) next.askTakeawayPhone = venue.askTakeawayPhone;
  if (venue.askTakeawayEmail != null) next.askTakeawayEmail = venue.askTakeawayEmail;
  if (venue.lockMins != null) next.lockMins = venue.lockMins;
  if (Array.isArray(venue.zones)) next.zones = venue.zones;
  if (venue.useBookings != null) next.useBookings = venue.useBookings;
  if (venue.bookingMins != null) next.bookingMins = venue.bookingMins;
  return next;
}

function normalizeGuestClaims(raw) {
  if (!raw || typeof raw !== "object") return {};
  const next = {};
  for (const [id, claim] of Object.entries(raw)) {
    if (!claim || typeof claim !== "object") continue;
    next[id] = {
      at: claim.at,
      status: claim.status === "accepted" ? "accepted" : "pending",
    };
  }
  return next;
}

export function toSnapshot(state) {
  return {
    schema: SCHEMA,
    checks: state.checks,
    chits: state.chits,
    nextCheck: state.nextCheck,
    nextChit: state.nextChit,
    nextTakeaway: state.nextTakeaway,
    lastBumpedChitId: state.lastBumpedChitId,
    guestClaims: normalizeGuestClaims(state.guestClaims),
    receipts: Array.isArray(state.receipts) ? state.receipts : [],
    bookings: Array.isArray(state.bookings) ? state.bookings : [],
    nextBooking: Number(state.nextBooking) || 1,
    venue: snapshotVenue(state.venue),
  };
}

export function fromSnapshot(raw, baseState) {
  if (!raw || raw.schema !== SCHEMA || !Array.isArray(raw.checks) || !Array.isArray(raw.chits)) {
    return null;
  }
  return {
    ...baseState,
    unlocked: false,
    pinError: null,
    checks: raw.checks,
    chits: raw.chits,
    nextCheck: Number(raw.nextCheck) || 1,
    nextChit: Number(raw.nextChit) || 1,
    nextTakeaway: Number(raw.nextTakeaway) || 1,
    lastBumpedChitId: raw.lastBumpedChitId ?? null,
    guestClaims: normalizeGuestClaims(raw.guestClaims),
    receipts: Array.isArray(raw.receipts) ? raw.receipts : [],
    bookings: Array.isArray(raw.bookings) ? raw.bookings : [],
    nextBooking: Number(raw.nextBooking) || 1,
    venue: { ...baseState.venue, ...raw.venue },
  };
}

export function readStore(storage) {
  try {
    const text = storage.getItem(STORAGE_KEY);
    if (!text) return null;
    return JSON.parse(text);
  } catch {
    return null;
  }
}

export function writeStore(state, storage) {
  storage.setItem(STORAGE_KEY, JSON.stringify(toSnapshot(state)));
}

export function loadState(baseState, storage) {
  return fromSnapshot(readStore(storage), baseState) ?? baseState;
}
