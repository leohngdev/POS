import { VENUE } from "./venue";

function nextId(prefix, n) {
  return `${prefix}-${n}`;
}

export function money(n) {
  return `$${n.toFixed(2)}`;
}

export function lineTotal(line) {
  return line.unitPrice * line.qty;
}

export function checkSubtotal(check) {
  return check.lines.reduce((sum, line) => sum + lineTotal(line), 0);
}

export function checkTotal(check, venue) {
  const sub = checkSubtotal(check);
  let total = sub;
  if (venue.gstEnabled) total += sub * venue.gstRate;
  if (venue.surchargeEnabled) total += sub * venue.surchargeRate;
  return total;
}

export function createInitialState() {
  return {
    unlocked: false,
    pinError: null,
    checks: [],
    chits: [],
    nextCheck: 1,
    nextChit: 1,
    nextTakeaway: 1,
    lastBumpedChitId: null,
    venue: {
      gstEnabled: VENUE.gstEnabled,
      gstRate: VENUE.gstRate,
      surchargeEnabled: VENUE.surchargeEnabled,
      surchargeRate: VENUE.surchargeRate,
    },
  };
}

export function clampRate(n, fallback) {
  if (typeof n !== "number" || Number.isNaN(n)) return fallback;
  return Math.min(1, Math.max(0, n));
}

export function updateVenueTaxes(state, patch) {
  const current = state.venue;
  return {
    ...state,
    venue: {
      gstEnabled: patch.gstEnabled ?? current.gstEnabled,
      gstRate: clampRate(patch.gstRate, current.gstRate),
      surchargeEnabled: patch.surchargeEnabled ?? current.surchargeEnabled,
      surchargeRate: clampRate(patch.surchargeRate, current.surchargeRate),
    },
  };
}

export function verifyPin(pin, venue) {
  return pin === venue.pin;
}

export function openCheckForTable(checks, tableId) {
  return checks.find((c) => c.channel === "dine-in" && c.tableId === tableId && c.status === "open") ?? null;
}

export function compactLines(qtyByItem, menu) {
  return menu
    .filter((item) => (qtyByItem[item.id] ?? 0) > 0)
    .map((item) => ({
      itemId: item.id,
      name: item.name,
      unitPrice: item.unitPrice,
      qty: qtyByItem[item.id],
    }));
}

export function send({ state, venue, channel, tableId, queueNumber, guestName, lines, now }) {
  if (!lines.length) {
    return { ok: false, error: "Add at least one item before Send.", state };
  }

  if (channel === "dine-in") {
    const existing = openCheckForTable(state.checks, tableId);
    if (!existing) {
      return sendNewCheck({ state, channel, tableId, queueNumber: null, guestName: null, lines, now });
    }
    if (existing.status === "paid") {
      return { ok: false, error: "This check is closed.", state };
    }
    return appendSend({ state, check: existing, lines, now });
  }

  return sendNewCheck({
    state,
    channel: "takeaway",
    tableId: null,
    queueNumber,
    guestName: guestName?.trim() ? guestName.trim() : null,
    lines,
    now,
  });
}

function sendNewCheck({ state, channel, tableId, queueNumber, guestName, lines, now }) {
  const check = {
    id: nextId("CHK", state.nextCheck),
    channel,
    tableId,
    queueNumber,
    guestName,
    status: "open",
    lines: lines.map((l) => ({ ...l })),
    paidVia: null,
  };
  const chit = makeChit({
    id: nextId("CHIT", state.nextChit),
    checkId: check.id,
    more: false,
    lines,
    now,
  });
  return {
    ok: true,
    error: null,
    state: {
      ...state,
      checks: [...state.checks, check],
      chits: [...state.chits, chit],
      nextCheck: state.nextCheck + 1,
      nextChit: state.nextChit + 1,
      nextTakeaway: channel === "takeaway" ? state.nextTakeaway + 1 : state.nextTakeaway,
    },
  };
}

function appendSend({ state, check, lines, now }) {
  const merged = mergeLines(check.lines, lines);
  const chit = makeChit({
    id: nextId("CHIT", state.nextChit),
    checkId: check.id,
    more: true,
    lines,
    now,
  });
  return {
    ok: true,
    error: null,
    state: {
      ...state,
      checks: state.checks.map((c) => (c.id === check.id ? { ...c, lines: merged } : c)),
      chits: [...state.chits, chit],
      nextChit: state.nextChit + 1,
    },
  };
}

function mergeLines(existing, incoming) {
  const byId = new Map(existing.map((l) => [l.itemId, { ...l }]));
  for (const line of incoming) {
    const prev = byId.get(line.itemId);
    if (prev) prev.qty += line.qty;
    else byId.set(line.itemId, { ...line });
  }
  return [...byId.values()];
}

function makeChit({ id, checkId, more, lines, now }) {
  return {
    id,
    checkId,
    more,
    lines: lines.map((l) => ({ ...l })),
    sentAt: now,
    status: "active",
    bumpedAt: null,
  };
}

export function payCheck(state, checkId, paidVia) {
  const check = state.checks.find((c) => c.id === checkId);
  if (!check) return { ok: false, error: "Check not found.", state };
  if (check.status === "paid") return { ok: false, error: "Already paid.", state };
  return {
    ok: true,
    error: null,
    state: {
      ...state,
      checks: state.checks.map((c) =>
        c.id === checkId ? { ...c, status: "paid", paidVia } : c
      ),
    },
  };
}

export function bumpChit(state, chitId, now) {
  const chit = state.chits.find((c) => c.id === chitId);
  if (!chit || chit.status !== "active") {
    return { ok: false, error: "Nothing to bump.", state };
  }
  return {
    ok: true,
    error: null,
    state: {
      ...state,
      lastBumpedChitId: chitId,
      chits: state.chits.map((c) =>
        c.id === chitId ? { ...c, status: "bumped", bumpedAt: now } : c
      ),
    },
  };
}

export function undoLastBump(state) {
  if (!state.lastBumpedChitId) {
    return { ok: false, error: "Nothing to undo.", state };
  }
  const id = state.lastBumpedChitId;
  return {
    ok: true,
    error: null,
    state: {
      ...state,
      lastBumpedChitId: null,
      chits: state.chits.map((c) =>
        c.id === id ? { ...c, status: "active", bumpedAt: null } : c
      ),
    },
  };
}

export function activeChits(state) {
  return state.chits
    .filter((c) => c.status === "active")
    .slice()
    .sort((a, b) => a.sentAt - b.sentAt);
}

/** FOH row for a check: cooking while kitchen still has a chit, else ready to pay. */
export function checkFloorStatus(check, chits) {
  if (check.status === "paid") return "paid";
  const cooking = chits.some((c) => c.checkId === check.id && c.status === "active");
  return cooking ? "cooking" : "ready";
}

export function checkLabel(check) {
  if (check.channel === "takeaway") {
    return check.guestName ? `${check.queueNumber} · ${check.guestName}` : check.queueNumber;
  }
  return `Table ${check.tableId}`;
}

export function nextQueueNumber(n) {
  return `T-${String(n).padStart(2, "0")}`;
}

export const LATE_MS = 8 * 60 * 1000;
