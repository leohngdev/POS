import { VENUE } from "./venue";

function nextId(prefix, n) {
  return `${prefix}-${n}`;
}

export function money(n) {
  return `$${Number(n).toFixed(2)}`;
}

export function roundMoney(n) {
  return Math.round((Number(n) || 0) * 100) / 100;
}

export function lineKey(line) {
  return `${line.itemId}\0${line.note ?? ""}`;
}

export function lineTotal(line) {
  return line.unitPrice * line.qty;
}

export function checkSubtotal(check) {
  return roundMoney((check.lines ?? []).reduce((sum, line) => sum + lineTotal(line), 0));
}

export function checkDiscount(check) {
  return roundMoney(checkSubtotal(check) * clampRate(Number(check.discountRate) || 0, 0));
}

export function checkNet(check) {
  return roundMoney(checkSubtotal(check) - checkDiscount(check));
}

export function checkTotal(check, venue) {
  const net = checkNet(check);
  let total = net;
  if (venue.gstEnabled) total += net * venue.gstRate;
  if (venue.surchargeEnabled) total += net * venue.surchargeRate;
  return roundMoney(total);
}

export function amountPaid(check) {
  if (check.status === "paid" && !(check.payments ?? []).length) return null;
  return roundMoney((check.payments ?? []).reduce((sum, p) => sum + Number(p.amount || 0), 0));
}

export function amountDue(check, venue) {
  if (check.status === "paid") return 0;
  const paid = amountPaid(check) ?? 0;
  return Math.max(0, roundMoney(checkTotal(check, venue) - paid));
}

export function clampRate(n, fallback) {
  if (typeof n !== "number" || Number.isNaN(n)) return fallback;
  return Math.min(1, Math.max(0, n));
}

export function clampCovers(n) {
  const v = Math.floor(Number(n));
  if (!Number.isFinite(v)) return 0;
  return Math.min(99, Math.max(0, v));
}

export function makeTables(count) {
  const n = Math.min(40, Math.max(1, Math.floor(Number(count) || 1)));
  return Array.from({ length: n }, (_, i) => String(i + 1).padStart(2, "0"));
}

export function defaultVenue() {
  return {
    name: VENUE.name,
    pin: VENUE.pin,
    tables: [...VENUE.tables],
    menu: VENUE.menu.map((i) => ({
      id: i.id,
      name: i.name,
      unitPrice: i.unitPrice,
      soldOut: Boolean(i.soldOut),
    })),
    gstEnabled: VENUE.gstEnabled,
    gstRate: VENUE.gstRate,
    surchargeEnabled: VENUE.surchargeEnabled,
    surchargeRate: VENUE.surchargeRate,
  };
}

export function normalizeVenue(raw) {
  const base = defaultVenue();
  if (!raw || typeof raw !== "object") return base;
  const menu = Array.isArray(raw.menu)
    ? raw.menu
        .filter((i) => i && i.id && i.name)
        .map((i) => ({
          id: String(i.id),
          name: String(i.name),
          unitPrice: Math.max(0, Number(i.unitPrice) || 0),
          soldOut: Boolean(i.soldOut),
        }))
    : null;
  const tables =
    Array.isArray(raw.tables) && raw.tables.length
      ? raw.tables.map((t) => String(t)).filter(Boolean)
      : base.tables;
  return {
    name: String(raw.name ?? base.name).trim() || base.name,
    pin: String(raw.pin ?? base.pin) || base.pin,
    tables,
    menu: menu && menu.length ? menu : base.menu,
    gstEnabled: Boolean(raw.gstEnabled ?? base.gstEnabled),
    gstRate: raw.gstRate === undefined ? base.gstRate : clampRate(Number(raw.gstRate), base.gstRate),
    surchargeEnabled: Boolean(raw.surchargeEnabled ?? base.surchargeEnabled),
    surchargeRate:
      raw.surchargeRate === undefined ? base.surchargeRate : clampRate(Number(raw.surchargeRate), base.surchargeRate),
  };
}

export function isCustomVenue(venue) {
  return JSON.stringify(normalizeVenue(venue)) !== JSON.stringify(defaultVenue());
}

export function liveTables(venue) {
  return normalizeVenue(venue).tables;
}

export function orderableMenu(menu) {
  return (menu ?? []).filter((item) => !item.soldOut);
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
    venue: defaultVenue(),
  };
}

export function updateVenue(state, patch) {
  return {
    ...state,
    venue: normalizeVenue({ ...state.venue, ...patch }),
  };
}

export function updateVenueTaxes(state, patch) {
  const next = {};
  if (patch.gstEnabled !== undefined) next.gstEnabled = patch.gstEnabled;
  if (patch.gstRate !== undefined) next.gstRate = patch.gstRate;
  if (patch.surchargeEnabled !== undefined) next.surchargeEnabled = patch.surchargeEnabled;
  if (patch.surchargeRate !== undefined) next.surchargeRate = patch.surchargeRate;
  return updateVenue(state, next);
}

export function setVenueName(state, name) {
  const trimmed = String(name ?? "").trim();
  if (!trimmed) return { ok: false, error: "Name the venue.", state };
  return { ok: true, error: null, state: updateVenue(state, { name: trimmed }) };
}

export function setPin(state, pin) {
  const digits = String(pin ?? "").replace(/\D/g, "");
  if (digits.length < 4 || digits.length > 8) {
    return { ok: false, error: "PIN must be 4–8 digits.", state };
  }
  return { ok: true, error: null, state: updateVenue(state, { pin: digits }) };
}

export function setTableCount(state, count) {
  const tables = makeTables(count);
  const current = liveTables(state.venue);
  const disappearing = current.filter((id) => !tables.includes(id));
  for (const id of disappearing) {
    if (openCheckForTable(state.checks, id) || state.guestClaims?.[id]) {
      return { ok: false, error: `Table ${id} still has a check or guest.`, state };
    }
  }
  return { ok: true, error: null, state: updateVenue(state, { tables }) };
}

function menuIdFromName(name, menu) {
  const slug =
    String(name)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 24) || "item";
  if (!menu.some((i) => i.id === slug)) return slug;
  let n = 2;
  while (menu.some((i) => i.id === `${slug}-${n}`)) n += 1;
  return `${slug}-${n}`;
}

export function addMenuItem(state, { name, unitPrice }) {
  const venue = normalizeVenue(state.venue);
  const trimmed = String(name ?? "").trim();
  if (!trimmed) return { ok: false, error: "Name the dish.", state };
  const price = Number(unitPrice);
  if (!Number.isFinite(price) || price < 0) return { ok: false, error: "Price must be a number.", state };
  const item = {
    id: menuIdFromName(trimmed, venue.menu),
    name: trimmed,
    unitPrice: roundMoney(price),
    soldOut: false,
  };
  return { ok: true, error: null, state: updateVenue(state, { menu: [...venue.menu, item] }) };
}

export function patchMenuItem(state, itemId, patch) {
  const venue = normalizeVenue(state.venue);
  if (!venue.menu.some((i) => i.id === itemId)) {
    return { ok: false, error: "No such dish.", state };
  }
  const menu = venue.menu.map((item) => {
    if (item.id !== itemId) return item;
    const name = patch.name != null ? String(patch.name).trim() || item.name : item.name;
    const unitPrice =
      patch.unitPrice != null ? Math.max(0, roundMoney(Number(patch.unitPrice) || 0)) : item.unitPrice;
    const soldOut = patch.soldOut != null ? Boolean(patch.soldOut) : item.soldOut;
    return { ...item, name, unitPrice, soldOut };
  });
  return { ok: true, error: null, state: updateVenue(state, { menu }) };
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

export function compactLines(qtyByItem, menu, notesByItem = {}) {
  return menu
    .filter((item) => (qtyByItem[item.id] ?? 0) > 0)
    .map((item) => {
      const note = String(notesByItem[item.id] ?? "").trim();
      const line = {
        itemId: item.id,
        name: item.name,
        unitPrice: item.unitPrice,
        qty: qtyByItem[item.id],
      };
      if (note) line.note = note;
      return line;
    });
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

export function send({ state, venue, channel, tableId, queueNumber, guestName, lines, now, requireClaim, covers, discountRate }) {
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
      result = sendNewCheck({
        state,
        channel,
        tableId,
        queueNumber: null,
        guestName: null,
        lines,
        now,
        source,
        covers,
        discountRate,
      });
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
    covers: 0,
    discountRate,
  });
}

function sendNewCheck({ state, channel, tableId, queueNumber, guestName, lines, now, source, covers, discountRate }) {
  const check = {
    id: nextId("CHK", state.nextCheck),
    channel,
    tableId,
    queueNumber,
    guestName,
    status: "open",
    lines: lines.map((l) => ({ ...l })),
    paidVia: null,
    covers: channel === "dine-in" ? clampCovers(covers) : 0,
    discountRate: clampRate(Number(discountRate) || 0, 0),
    payments: [],
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
  const byKey = new Map(existing.map((l) => [lineKey(l), { ...l }]));
  for (const line of incoming) {
    const key = lineKey(line);
    const prev = byKey.get(key);
    if (prev) prev.qty += line.qty;
    else byKey.set(key, { ...line });
  }
  return [...byKey.values()];
}

function subtractLines(existing, incoming) {
  const byKey = new Map(existing.map((l) => [lineKey(l), { ...l }]));
  for (const line of incoming) {
    const key = lineKey(line);
    const prev = byKey.get(key);
    if (!prev) continue;
    prev.qty -= line.qty;
    if (prev.qty <= 0) byKey.delete(key);
  }
  return [...byKey.values()];
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

export function payCheck(state, checkId, paidVia, amount) {
  return tender(state, checkId, paidVia, amount);
}

export function tender(state, checkId, via, amount) {
  if (via !== "card" && via !== "cash") {
    return { ok: false, error: "Card or cash.", state };
  }
  const check = state.checks.find((c) => c.id === checkId);
  if (!check) return { ok: false, error: "Check not found.", state };
  if (check.status === "paid") return { ok: false, error: "Already paid.", state };
  const venue = normalizeVenue(state.venue);
  const due = amountDue(check, venue);
  if (due <= 0) return { ok: false, error: "Already paid.", state };
  const payAmt = amount == null || amount === "" ? due : roundMoney(Number(amount));
  if (!Number.isFinite(payAmt) || payAmt <= 0) {
    return { ok: false, error: "Enter an amount.", state };
  }
  if (payAmt > due + 0.001) {
    return { ok: false, error: "That's more than remaining.", state };
  }
  const payments = [...(check.payments ?? []), { via, amount: payAmt }];
  const remaining = roundMoney(due - payAmt);
  const closed = remaining <= 0;
  const vias = [...new Set(payments.map((p) => p.via))];
  return {
    ok: true,
    error: null,
    state: {
      ...state,
      checks: state.checks.map((c) =>
        c.id === checkId
          ? {
              ...c,
              payments,
              status: closed ? "paid" : "open",
              paidVia: closed ? (vias.length === 1 ? vias[0] : "split") : null,
            }
          : c
      ),
    },
  };
}

export function setCheckCovers(state, checkId, covers) {
  const check = state.checks.find((c) => c.id === checkId);
  if (!check || check.status === "paid") return { ok: false, error: "No open check.", state };
  if (check.channel !== "dine-in") return { ok: false, error: "Covers are for dine-in.", state };
  return {
    ok: true,
    error: null,
    state: {
      ...state,
      checks: state.checks.map((c) => (c.id === checkId ? { ...c, covers: clampCovers(covers) } : c)),
    },
  };
}

export function setCheckDiscount(state, checkId, rate) {
  const check = state.checks.find((c) => c.id === checkId);
  if (!check || check.status === "paid") return { ok: false, error: "No open check.", state };
  return {
    ok: true,
    error: null,
    state: {
      ...state,
      checks: state.checks.map((c) =>
        c.id === checkId ? { ...c, discountRate: clampRate(Number(rate) || 0, 0) } : c
      ),
    },
  };
}

export function nightReport(state) {
  const venue = normalizeVenue(state.venue);
  const paid = state.checks.filter((c) => c.status === "paid");
  const open = state.checks.filter((c) => c.status === "open");
  const salesOf = (list) => roundMoney(list.reduce((sum, c) => sum + checkTotal(c, venue), 0));
  const viaOf = (via) => salesOf(paid.filter((c) => c.paidVia === via));
  const channelOf = (channel) => {
    const list = paid.filter((c) => c.channel === channel);
    return { count: list.length, sales: salesOf(list) };
  };
  return {
    paidCount: paid.length,
    openCount: open.length,
    sales: salesOf(paid),
    covers: paid.reduce((sum, c) => sum + (Number(c.covers) || 0), 0),
    card: viaOf("card"),
    cash: viaOf("cash"),
    split: viaOf("split"),
    dineIn: channelOf("dine-in"),
    takeaway: channelOf("takeaway"),
  };
}

export function endNight(state) {
  const keep = state.checks.filter((c) => c.status !== "paid");
  const keepIds = new Set(keep.map((c) => c.id));
  const lastBumpedChitId = keepIds.has(
    state.chits.find((c) => c.id === state.lastBumpedChitId)?.checkId
  )
    ? state.lastBumpedChitId
    : null;
  return {
    ok: true,
    error: null,
    state: {
      ...state,
      checks: keep,
      chits: state.chits.filter((c) => keepIds.has(c.checkId)),
      lastBumpedChitId,
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
  const covers = Number(check.covers) || 0;
  return covers > 0 ? `Table ${check.tableId} · ${covers}` : `Table ${check.tableId}`;
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
    const covers = clampCovers((Number(dest.covers) || 0) + (Number(source.covers) || 0));
    const discountRate = dest.discountRate || source.discountRate || 0;
    const payments = [...(dest.payments ?? []), ...(source.payments ?? [])];
    checks = state.checks
      .filter((c) => c.id !== source.id)
      .map((c) =>
        c.id === dest.id ? { ...c, lines: mergedLines, covers, discountRate, payments } : c
      );
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
