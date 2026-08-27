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

export function checkOffers(check) {
  if (Array.isArray(check.offers) && check.offers.length) return check.offers;
  const rate = Number(check.discountRate) || 0;
  if (rate > 0) return [{ id: "legacy", name: "Discount", kind: "percent", value: rate }];
  return [];
}

export function checkDiscount(check) {
  let left = checkSubtotal(check);
  let taken = 0;
  for (const offer of checkOffers(check)) {
    let cut = 0;
    if (offer.kind === "amount") cut = Math.min(left, roundMoney(Number(offer.value) || 0));
    else cut = roundMoney(left * clampRate(Number(offer.value) || 0, 0));
    taken += cut;
    left = roundMoney(Math.max(0, left - cut));
  }
  return roundMoney(taken);
}

export function checkNet(check) {
  return roundMoney(checkSubtotal(check) - checkDiscount(check));
}

export function activeSurchargeRate(venue, at = Date.now()) {
  if (!venue?.surchargeEnabled) return 0;
  const days = venue.surchargeByDay;
  if (Array.isArray(days) && days.length === 7) {
    return clampRate(Number(days[new Date(at).getDay()]), 0);
  }
  return clampRate(Number(venue.surchargeRate) || 0, 0);
}

export function checkTotal(check, venue, at) {
  if (check.status === "paid" && check.closedTotal != null) return Number(check.closedTotal);
  const net = checkNet(check);
  let total = net;
  if (venue.gstEnabled) total += net * venue.gstRate;
  const sur = activeSurchargeRate(venue, at ?? Date.now());
  if (sur) total += net * sur;
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

export const TABLE_W = 88;
export const TABLE_H = 64;
export const TABLE_GAP = 16;
export const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function padTableId(raw) {
  const digits = String(raw ?? "").replace(/\D/g, "");
  if (!digits) return null;
  const n = Number(digits);
  if (!Number.isInteger(n) || n < 0) return null;
  return n > 99 ? String(n) : String(n).padStart(2, "0");
}

export function layoutTable(id, index) {
  const col = index % 4;
  const row = Math.floor(index / 4);
  return {
    id,
    x: col * (TABLE_W + TABLE_GAP),
    y: row * (TABLE_H + TABLE_GAP),
    seats: 4,
    shape: "square",
  };
}

export function normalizeTable(raw, index = 0) {
  if (typeof raw === "string") return layoutTable(raw, index);
  if (!raw || typeof raw !== "object") return layoutTable(padTableId(index + 1) ?? "01", index);
  const id = padTableId(raw.id) ?? padTableId(raw.label) ?? layoutTable("01", index).id;
  return {
    id,
    x: Number.isFinite(Number(raw.x)) ? Number(raw.x) : layoutTable(id, index).x,
    y: Number.isFinite(Number(raw.y)) ? Number(raw.y) : layoutTable(id, index).y,
    seats: Math.min(20, Math.max(1, Math.floor(Number(raw.seats) || 4))),
    shape: raw.shape === "round" ? "round" : "square",
  };
}

export function clampCovers(n) {
  const v = Math.floor(Number(n));
  if (!Number.isFinite(v)) return 0;
  return Math.min(99, Math.max(0, v));
}

export function makeTables(count) {
  const n = Math.min(40, Math.max(1, Math.floor(Number(count) || 1)));
  return Array.from({ length: n }, (_, i) => layoutTable(String(i + 1).padStart(2, "0"), i));
}

function normalizeOffer(raw) {
  if (!raw || !raw.name) return null;
  const kind = raw.kind === "amount" ? "amount" : "percent";
  const value =
    kind === "amount"
      ? Math.max(0, roundMoney(Number(raw.value) || 0))
      : clampRate(Number(raw.value) || 0, 0);
  return {
    id: String(raw.id || menuIdFromName(raw.name, [])),
    name: String(raw.name).trim(),
    kind,
    value,
  };
}

export function defaultVenue() {
  const tables = VENUE.tables.map((id, i) => layoutTable(id, i));
  return {
    name: VENUE.name,
    pin: VENUE.pin,
    tables,
    menu: VENUE.menu.map((i) => ({
      id: i.id,
      name: i.name,
      unitPrice: i.unitPrice,
      soldOut: Boolean(i.soldOut),
      photo: i.photo ?? null,
    })),
    gstEnabled: VENUE.gstEnabled,
    gstRate: VENUE.gstRate,
    surchargeEnabled: VENUE.surchargeEnabled,
    surchargeRate: VENUE.surchargeRate,
    surchargeByDay: [0, 1, 2, 3, 4, 5, 6].map(() => VENUE.surchargeRate),
    offers: [],
    askTakeawayPhone: false,
    askTakeawayEmail: false,
    lockMins: 0,
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
          photo: typeof i.photo === "string" && i.photo.startsWith("data:") ? i.photo : null,
        }))
    : null;
  const tables = Array.isArray(raw.tables) && raw.tables.length
    ? raw.tables.map((t, i) => normalizeTable(t, i))
    : base.tables;
  const seen = new Set();
  const unique = [];
  for (const t of tables) {
    if (seen.has(t.id)) continue;
    seen.add(t.id);
    unique.push(t);
  }
  const offers = Array.isArray(raw.offers) ? raw.offers.map(normalizeOffer).filter(Boolean) : base.offers;
  const surchargeByDay =
    Array.isArray(raw.surchargeByDay) && raw.surchargeByDay.length === 7
      ? raw.surchargeByDay.map((n) => clampRate(Number(n), base.surchargeRate))
      : [0, 1, 2, 3, 4, 5, 6].map(() =>
          raw.surchargeRate === undefined ? base.surchargeRate : clampRate(Number(raw.surchargeRate), base.surchargeRate)
        );
  return {
    name: String(raw.name ?? base.name).trim() || base.name,
    pin: String(raw.pin ?? base.pin) || base.pin,
    tables: unique.length ? unique : base.tables,
    menu: menu && menu.length ? menu : base.menu,
    gstEnabled: Boolean(raw.gstEnabled ?? base.gstEnabled),
    gstRate: raw.gstRate === undefined ? base.gstRate : clampRate(Number(raw.gstRate), base.gstRate),
    surchargeEnabled: Boolean(raw.surchargeEnabled ?? base.surchargeEnabled),
    surchargeRate: surchargeByDay[1],
    surchargeByDay,
    offers,
    askTakeawayPhone: Boolean(raw.askTakeawayPhone),
    askTakeawayEmail: Boolean(raw.askTakeawayEmail),
    lockMins: [0, 5, 10, 30].includes(Number(raw.lockMins)) ? Number(raw.lockMins) : 0,
  };
}

export function isCustomVenue(venue) {
  return JSON.stringify(normalizeVenue(venue)) !== JSON.stringify(defaultVenue());
}

export function liveTables(venue) {
  return normalizeVenue(venue).tables.map((t) => t.id);
}

export function tableRecords(venue) {
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
    receipts: [],
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
  if (patch.surchargeByDay !== undefined) next.surchargeByDay = patch.surchargeByDay;
  if (patch.askTakeawayPhone !== undefined) next.askTakeawayPhone = patch.askTakeawayPhone;
  if (patch.askTakeawayEmail !== undefined) next.askTakeawayEmail = patch.askTakeawayEmail;
  if (patch.lockMins !== undefined) next.lockMins = patch.lockMins;
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
  const nextIds = new Set(tables.map((t) => t.id));
  const current = liveTables(state.venue);
  const disappearing = current.filter((id) => !nextIds.has(id));
  for (const id of disappearing) {
    if (openCheckForTable(state.checks, id) || state.guestClaims?.[id]) {
      return { ok: false, error: `Table ${id} still has a check or guest.`, state };
    }
  }
  return { ok: true, error: null, state: updateVenue(state, { tables }) };
}

export function addTable(state, rawId) {
  const id = padTableId(rawId);
  if (!id) return { ok: false, error: "Give the table a number.", state };
  const venue = normalizeVenue(state.venue);
  if (venue.tables.some((t) => t.id === id)) {
    return { ok: false, error: `Table ${id} is already on the floor.`, state };
  }
  if (venue.tables.length >= 40) return { ok: false, error: "Forty tables is the cap.", state };
  const tables = [...venue.tables, layoutTable(id, venue.tables.length)];
  return { ok: true, error: null, state: updateVenue(state, { tables }) };
}

export function removeTable(state, tableId) {
  if (openCheckForTable(state.checks, tableId) || state.guestClaims?.[tableId]) {
    return { ok: false, error: `Table ${tableId} still has a check or guest.`, state };
  }
  const venue = normalizeVenue(state.venue);
  if (venue.tables.length <= 1) return { ok: false, error: "Keep at least one table.", state };
  if (!venue.tables.some((t) => t.id === tableId)) {
    return { ok: false, error: "No such table.", state };
  }
  return {
    ok: true,
    error: null,
    state: updateVenue(state, { tables: venue.tables.filter((t) => t.id !== tableId) }),
  };
}

export function patchTable(state, tableId, patch) {
  const venue = normalizeVenue(state.venue);
  if (!venue.tables.some((t) => t.id === tableId)) {
    return { ok: false, error: "No such table.", state };
  }
  const tables = venue.tables.map((t) => (t.id === tableId ? normalizeTable({ ...t, ...patch, id: t.id }) : t));
  return { ok: true, error: null, state: updateVenue(state, { tables }) };
}

export function addOffer(state, draft) {
  const offer = normalizeOffer({ ...draft, id: draft.id || menuIdFromName(draft.name || "offer", []) });
  if (!offer || !offer.name) return { ok: false, error: "Name the discount.", state };
  if (offer.kind === "amount" && !(offer.value > 0)) return { ok: false, error: "Enter a dollar amount.", state };
  if (offer.kind === "percent" && !(offer.value > 0)) return { ok: false, error: "Enter a percent.", state };
  const venue = normalizeVenue(state.venue);
  if (venue.offers.some((o) => o.id === offer.id)) offer.id = `${offer.id}-${venue.offers.length + 1}`;
  return { ok: true, error: null, state: updateVenue(state, { offers: [...venue.offers, offer] }) };
}

export function removeOffer(state, offerId) {
  const venue = normalizeVenue(state.venue);
  return {
    ok: true,
    error: null,
    state: updateVenue(state, { offers: venue.offers.filter((o) => o.id !== offerId) }),
  };
}

export function patchOffer(state, offerId, patch) {
  const venue = normalizeVenue(state.venue);
  const offers = venue.offers.map((o) => (o.id === offerId ? normalizeOffer({ ...o, ...patch, id: o.id }) : o)).filter(Boolean);
  return { ok: true, error: null, state: updateVenue(state, { offers }) };
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
    photo: null,
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
    const photo = patch.photo !== undefined ? patch.photo : item.photo;
    return { ...item, name, unitPrice, soldOut, photo };
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

export function send({
  state,
  venue,
  channel,
  tableId,
  queueNumber,
  guestName,
  guestPhone,
  guestEmail,
  lines,
  now,
  requireClaim,
  covers,
  discountRate,
  offers,
}) {
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
        offers,
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
    offers,
    guestPhone,
    guestEmail,
  });
}

function sendNewCheck({
  state,
  channel,
  tableId,
  queueNumber,
  guestName,
  guestPhone,
  guestEmail,
  lines,
  now,
  source,
  covers,
  discountRate,
  offers,
}) {
  const check = {
    id: nextId("CHK", state.nextCheck),
    channel,
    tableId,
    queueNumber,
    guestName,
    guestPhone: guestPhone?.trim() ? guestPhone.trim() : null,
    guestEmail: guestEmail?.trim() ? guestEmail.trim() : null,
    status: "open",
    lines: lines.map((l) => ({ ...l })),
    paidVia: null,
    covers: channel === "dine-in" ? clampCovers(covers) : 0,
    discountRate: clampRate(Number(discountRate) || 0, 0),
    offers: Array.isArray(offers) ? offers.map(normalizeOffer).filter(Boolean) : [],
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
  const paidVia = closed ? (vias.length === 1 ? vias[0] : "split") : null;
  const closedTotal = closed ? checkTotal({ ...check, payments, status: "open" }, venue) : check.closedTotal;
  let next = {
    ...state,
    checks: state.checks.map((c) =>
      c.id === checkId
        ? {
            ...c,
            payments,
            status: closed ? "paid" : "open",
            paidVia,
            closedTotal: closed ? closedTotal : c.closedTotal,
            closedAt: closed ? Date.now() : c.closedAt,
          }
        : c
    ),
  };
  if (closed) {
    const paid = next.checks.find((c) => c.id === checkId);
    next = archiveReceipt(next, paid, venue);
  }
  return { ok: true, error: null, state: next };
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

export function applyCheckOffer(state, checkId, offer) {
  const check = state.checks.find((c) => c.id === checkId);
  if (!check || check.status === "paid") return { ok: false, error: "No open check.", state };
  const nextOffer = normalizeOffer(offer);
  if (!nextOffer) return { ok: false, error: "Pick a discount.", state };
  const offers = [...checkOffers(check).filter((o) => o.id !== nextOffer.id), nextOffer];
  return {
    ok: true,
    error: null,
    state: {
      ...state,
      checks: state.checks.map((c) => (c.id === checkId ? { ...c, offers, discountRate: 0 } : c)),
    },
  };
}

export function removeCheckOffer(state, checkId, offerId) {
  const check = state.checks.find((c) => c.id === checkId);
  if (!check || check.status === "paid") return { ok: false, error: "No open check.", state };
  return {
    ok: true,
    error: null,
    state: {
      ...state,
      checks: state.checks.map((c) =>
        c.id === checkId ? { ...c, offers: checkOffers(c).filter((o) => o.id !== offerId), discountRate: 0 } : c
      ),
    },
  };
}

export function setCheckDiscount(state, checkId, rate) {
  const value = clampRate(Number(rate) || 0, 0);
  if (!value) {
    const check = state.checks.find((c) => c.id === checkId);
    if (!check || check.status === "paid") return { ok: false, error: "No open check.", state };
    return {
      ok: true,
      error: null,
      state: {
        ...state,
        checks: state.checks.map((c) => (c.id === checkId ? { ...c, offers: [], discountRate: 0 } : c)),
      },
    };
  }
  return applyCheckOffer(state, checkId, { id: "comp", name: "Discount", kind: "percent", value });
}

export function makeReceipt(check, venue, at = Date.now()) {
  const priced = { ...check, status: "open", closedTotal: undefined };
  return {
    id: check.id,
    at,
    channel: check.channel,
    tableId: check.tableId,
    queueNumber: check.queueNumber,
    guestName: check.guestName,
    guestPhone: check.guestPhone ?? null,
    guestEmail: check.guestEmail ?? null,
    lines: (check.lines ?? []).map((l) => ({ ...l })),
    offers: checkOffers(check),
    payments: [...(check.payments ?? [])],
    paidVia: check.paidVia,
    guests: Number(check.covers) || 0,
    subtotal: checkSubtotal(check),
    discount: checkDiscount(check),
    total: check.closedTotal ?? checkTotal(priced, venue, at),
    venueName: venue.name,
  };
}

function archiveReceipt(state, check, venue) {
  if (!check) return state;
  const receipts = [...(state.receipts ?? [])];
  if (receipts.some((r) => r.id === check.id)) return { ...state, receipts };
  return { ...state, receipts: [makeReceipt(check, venue, check.closedAt ?? Date.now()), ...receipts].slice(0, 200) };
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
    guests: paid.reduce((sum, c) => sum + (Number(c.covers) || 0), 0),
    card: viaOf("card"),
    cash: viaOf("cash"),
    split: viaOf("split"),
    dineIn: channelOf("dine-in"),
    takeaway: channelOf("takeaway"),
  };
}

export function endNight(state) {
  const venue = normalizeVenue(state.venue);
  let receipts = [...(state.receipts ?? [])];
  for (const check of state.checks.filter((c) => c.status === "paid")) {
    if (!receipts.some((r) => r.id === check.id)) {
      receipts = [makeReceipt(check, venue, check.closedAt ?? Date.now()), ...receipts];
    }
  }
  const keep = state.checks.filter((c) => c.status !== "paid");
  const keepIds = new Set(keep.map((c) => c.id));
  const lastBumpedChitId = keepIds.has(state.chits.find((c) => c.id === state.lastBumpedChitId)?.checkId)
    ? state.lastBumpedChitId
    : null;
  return {
    ok: true,
    error: null,
    state: {
      ...state,
      checks: keep,
      chits: state.chits.filter((c) => keepIds.has(c.checkId)),
      receipts: receipts.slice(0, 200),
      lastBumpedChitId,
      guestClaims: {},
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
  const padded = padTableId(raw);
  if (!padded) return null;
  const ids = Array.isArray(tables) ? tables.map((t) => (typeof t === "string" ? t : t.id)) : [];
  return ids.includes(padded) ? padded : null;
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
    const offers = [...checkOffers(dest), ...checkOffers(source).filter((o) => !checkOffers(dest).some((d) => d.id === o.id))];
    const payments = [...(dest.payments ?? []), ...(source.payments ?? [])];
    checks = state.checks
      .filter((c) => c.id !== source.id)
      .map((c) =>
        c.id === dest.id ? { ...c, lines: mergedLines, covers, offers, discountRate: 0, payments } : c
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
