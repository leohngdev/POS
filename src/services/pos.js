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
    guestClaims: {},
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

export function lastPaidCheckForTable(checks, tableId) {
  const paid = checks.filter((c) => c.channel === "dine-in" && c.tableId === tableId && c.status === "paid");
  return paid.length ? paid[paid.length - 1] : null;
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

export const CLAIM_REQUIRED = "Floor rejected this table. Claim it again.";

export function hasGuestClaim(state, tableId) {
  return Boolean(state.guestClaims?.[tableId]);
}

export function guestClaimStatus(claim) {
  if (!claim) return null;
  return claim.status === "accepted" ? "accepted" : "pending";
}

export function tableClaimStatus(state, tableId) {
  return guestClaimStatus(state.guestClaims?.[tableId]);
}

export function hasPendingGuestClaims(state) {
  return Object.values(state.guestClaims ?? {}).some((c) => guestClaimStatus(c) === "pending");
}

export function pendingGuestTables(state, tables) {
  return tables.filter((id) => tableClaimStatus(state, id) === "pending");
}

export function send({ state, venue, channel, tableId, queueNumber, guestName, lines, now, requireClaim }) {
  if (!lines.length) {
    return { ok: false, error: "Add at least one item before Send.", state };
  }

  const source = requireClaim ? "guest" : "staff";

  if (channel === "dine-in") {
    if (requireClaim && !hasGuestClaim(state, tableId)) {
      return { ok: false, error: CLAIM_REQUIRED, state };
    }
    const existing = openCheckForTable(state.checks, tableId);
    let result;
    if (!existing) {
      result = sendNewCheck({ state, channel, tableId, queueNumber: null, guestName: null, lines, now, source });
    } else if (existing.status === "paid") {
      return { ok: false, error: "This check is closed.", state };
    } else {
      result = appendSend({ state, check: existing, lines, now, source });
    }
    return seatStaffSend(result, tableId, source);
  }

  return sendNewCheck({
    state,
    channel: "takeaway",
    tableId: null,
    queueNumber,
    guestName: guestName?.trim() ? guestName.trim() : null,
    lines,
    now,
    source: "staff",
  });
}

function sendNewCheck({ state, channel, tableId, queueNumber, guestName, lines, now, source }) {
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
    source,
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

function appendSend({ state, check, lines, now, source }) {
  const merged = mergeLines(check.lines, lines);
  const chit = makeChit({
    id: nextId("CHIT", state.nextChit),
    checkId: check.id,
    more: true,
    lines,
    now,
    source,
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

function subtractLines(existing, incoming) {
  const byId = new Map(existing.map((l) => [l.itemId, { ...l }]));
  for (const line of incoming) {
    const prev = byId.get(line.itemId);
    if (!prev) continue;
    prev.qty -= line.qty;
    if (prev.qty <= 0) byId.delete(line.itemId);
  }
  return [...byId.values()];
}

function makeChit({ id, checkId, more, lines, now, source }) {
  return {
    id,
    checkId,
    more,
    source: source ?? "staff",
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

export function tableFloorStatus(state, tableId) {
  const check = openCheckForTable(state.checks, tableId);
  if (!check) return "empty";
  return checkFloorStatus(check, state.chits);
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

export function normalizeTableId(raw, tables) {
  if (raw == null || raw === "") return null;
  const digits = String(raw).replace(/\D/g, "");
  if (!digits) return null;
  const n = Number(digits);
  if (!Number.isInteger(n) || n < 0) return null;
  const padded = String(n).padStart(2, "0");
  return tables.includes(padded) ? padded : null;
}

export function claimTable(state, tableId, tables, now) {
  if (!tables.includes(tableId)) {
    return { ok: false, error: "Unknown table.", state };
  }
  const existing = state.guestClaims?.[tableId];
  const status = guestClaimStatus(existing) === "accepted" ? "accepted" : "pending";
  return {
    ok: true,
    error: null,
    state: {
      ...state,
      guestClaims: { ...(state.guestClaims ?? {}), [tableId]: { at: now, status } },
    },
  };
}

export function acceptClaim(state, tableId) {
  const claim = state.guestClaims?.[tableId];
  if (!claim) {
    return { ok: false, error: "No guest on that table.", state };
  }
  if (guestClaimStatus(claim) === "accepted") {
    return { ok: true, error: null, state };
  }
  return {
    ok: true,
    error: null,
    state: {
      ...state,
      guestClaims: {
        ...(state.guestClaims ?? {}),
        [tableId]: { ...claim, status: "accepted" },
      },
    },
  };
}

function seatStaffSend(result, tableId, source) {
  if (!result.ok || source !== "staff" || !tableId) return result;
  const seated = acceptClaim(result.state, tableId);
  return seated.ok ? { ...result, state: seated.state } : result;
}

export function releaseClaim(state, tableId) {
  const next = { ...(state.guestClaims ?? {}) };
  delete next[tableId];
  return { ok: true, error: null, state: { ...state, guestClaims: next } };
}

export function rejectClaim(state, tableId) {
  const released = releaseClaim(state, tableId).state;
  const check = openCheckForTable(released.checks, tableId);
  if (!check || check.status === "paid") {
    return { ok: true, error: null, state: released };
  }

  const guestChits = released.chits.filter((c) => c.checkId === check.id && c.source === "guest");
  if (guestChits.length === 0) {
    return { ok: true, error: null, state: released };
  }

  const remainingLines = subtractLines(
    check.lines,
    guestChits.flatMap((c) => c.lines)
  );
  const removedIds = new Set(guestChits.map((c) => c.id));
  let chits = released.chits.filter((c) => !removedIds.has(c.id));
  const lastBumpedChitId = removedIds.has(released.lastBumpedChitId) ? null : released.lastBumpedChitId;

  let checks;
  if (remainingLines.length === 0) {
    checks = released.checks.filter((c) => c.id !== check.id);
    chits = chits.filter((c) => c.checkId !== check.id);
  } else {
    checks = released.checks.map((c) => (c.id === check.id ? { ...c, lines: remainingLines } : c));
  }

  return {
    ok: true,
    error: null,
    state: { ...released, checks, chits, lastBumpedChitId },
  };
}

export function lastChitForCheck(state, checkId) {
  const chits = state.chits.filter((c) => c.checkId === checkId);
  return chits.length ? chits[chits.length - 1] : null;
}

export function canVoidLastSend(state, checkId) {
  const check = state.checks.find((c) => c.id === checkId);
  if (!check || check.status === "paid") return false;
  const last = lastChitForCheck(state, checkId);
  return Boolean(last && last.status === "active");
}

export function voidLastSend(state, checkId) {
  const check = state.checks.find((c) => c.id === checkId);
  if (!check || check.status === "paid") {
    return { ok: false, error: "Nothing to void.", state };
  }
  const last = lastChitForCheck(state, checkId);
  if (!last) {
    return { ok: false, error: "Nothing to void.", state };
  }
  if (last.status !== "active") {
    return { ok: false, error: "Kitchen already bumped that Send.", state };
  }

  const remainingLines = subtractLines(check.lines, last.lines);
  const chits = state.chits.filter((c) => c.id !== last.id);
  const lastBumpedChitId = state.lastBumpedChitId === last.id ? null : state.lastBumpedChitId;

  if (remainingLines.length === 0) {
    return {
      ok: true,
      error: null,
      state: {
        ...state,
        checks: state.checks.filter((c) => c.id !== checkId),
        chits: chits.filter((c) => c.checkId !== checkId),
        lastBumpedChitId,
      },
    };
  }

  return {
    ok: true,
    error: null,
    state: {
      ...state,
      checks: state.checks.map((c) => (c.id === checkId ? { ...c, lines: remainingLines } : c)),
      chits,
      lastBumpedChitId,
    },
  };
}

export function moveTargets(_state, tables, fromTableId) {
  return tables.filter((id) => id !== fromTableId);
}

export function moveTable(state, fromTableId, toTableId, tables) {
  if (!tables.includes(toTableId) || fromTableId === toTableId) {
    return { ok: false, error: "Pick a different table.", state };
  }
  const source = openCheckForTable(state.checks, fromTableId);
  const dest = openCheckForTable(state.checks, toTableId);
  const sourceClaim = state.guestClaims?.[fromTableId];
  const destClaim = state.guestClaims?.[toTableId];
  if (!source && !sourceClaim) {
    return { ok: false, error: "Nothing to move.", state };
  }

  let checks = state.checks;
  let chits = state.chits;

  if (source && dest) {
    const mergedLines = mergeLines(dest.lines, source.lines);
    const destHasChits = state.chits.some((c) => c.checkId === dest.id);
    checks = state.checks
      .filter((c) => c.id !== source.id)
      .map((c) => (c.id === dest.id ? { ...c, lines: mergedLines } : c));
    chits = state.chits.map((c) =>
      c.checkId === source.id ? { ...c, checkId: dest.id, more: destHasChits ? true : c.more } : c
    );
  } else if (source) {
    checks = state.checks.map((c) => (c.id === source.id ? { ...c, tableId: toTableId } : c));
  }

  const guestClaims = { ...(state.guestClaims ?? {}) };
  if (sourceClaim) {
    delete guestClaims[fromTableId];
    if (!destClaim) guestClaims[toTableId] = sourceClaim;
  }

  return { ok: true, error: null, state: { ...state, checks, chits, guestClaims } };
}

export const LATE_MS = 8 * 60 * 1000;
export const NEW_CHIT_MS = 4000;
