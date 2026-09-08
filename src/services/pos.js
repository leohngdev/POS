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
export const STAFF_ROLES = ["floor", "kitchen", "any"];
export const DEFAULT_SERVICES = [
  { id: "lunch", name: "Lunch" },
  { id: "dinner", name: "Dinner" },
];

export function padTableId(raw) {
  const digits = String(raw ?? "").replace(/\D/g, "");
  if (!digits) return null;
  const n = Number(digits);
  if (!Number.isInteger(n) || n < 0) return null;
  return n > 99 ? String(n) : String(n).padStart(2, "0");
}

/** What staff printed on the table: 1a, 1b, 4, 17, Bar-3. Not a padded spreadsheet id. */
export function tableLabel(raw) {
  const s = String(raw ?? "")
    .trim()
    .replace(/\s+/g, "");
  if (!s || s.length > 12) return null;
  if (!/^[A-Za-z0-9][A-Za-z0-9-]{0,11}$/.test(s)) return null;
  return s;
}

export function tableKey(id) {
  return String(id ?? "")
    .trim()
    .toLowerCase();
}

function numericTableKey(id) {
  const s = tableKey(id);
  if (!/^\d+$/.test(s)) return null;
  return String(Number(s));
}

export function sameTable(a, b) {
  if (!a || !b) return false;
  if (tableKey(a) === tableKey(b)) return true;
  const na = numericTableKey(a);
  const nb = numericTableKey(b);
  return na != null && na === nb;
}

export function tableIds(tables) {
  if (!Array.isArray(tables)) return [];
  return tables.map((t) => (typeof t === "string" ? t : t?.id)).filter(Boolean);
}

function slugId(name, existing) {
  const slug =
    String(name)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 24) || "id";
  if (!existing.includes(slug)) return slug;
  let n = 2;
  while (existing.includes(`${slug}-${n}`)) n += 1;
  return `${slug}-${n}`;
}

export const DEFAULT_ZONE = { id: "floor", name: "Floor" };
export const BOOKING_MINS = [60, 90, 120, 150];

export function layoutTable(id, index, zoneId = DEFAULT_ZONE.id) {
  const col = index % 4;
  const row = Math.floor(index / 4);
  return {
    id,
    x: col * (TABLE_W + TABLE_GAP),
    y: row * (TABLE_H + TABLE_GAP),
    seats: 4,
    shape: "square",
    zoneId,
  };
}

export function normalizeZone(raw, index = 0, taken = []) {
  const name = String(raw?.name ?? "").trim() || (index === 0 ? DEFAULT_ZONE.name : `Area ${index + 1}`);
  const id = String(raw?.id || slugId(name, taken)).slice(0, 24);
  return { id, name };
}

export function normalizeTable(raw, index = 0, zoneId = DEFAULT_ZONE.id) {
  if (typeof raw === "string") {
    const id = tableLabel(raw) ?? padTableId(raw) ?? `T${index + 1}`;
    return layoutTable(id, index, zoneId);
  }
  if (!raw || typeof raw !== "object") return layoutTable(padTableId(index + 1) ?? "01", index, zoneId);
  const id = tableLabel(raw.id) ?? tableLabel(raw.label) ?? padTableId(raw.id) ?? `T${index + 1}`;
  const zid = String(raw.zoneId || zoneId || DEFAULT_ZONE.id);
  return {
    id,
    x: Number.isFinite(Number(raw.x)) ? Number(raw.x) : layoutTable(id, index).x,
    y: Number.isFinite(Number(raw.y)) ? Number(raw.y) : layoutTable(id, index).y,
    seats: Math.min(20, Math.max(1, Math.floor(Number(raw.seats) || 4))),
    shape: raw.shape === "round" ? "round" : "square",
    zoneId: zid,
  };
}

export function clampCovers(n) {
  const v = Math.floor(Number(n));
  if (!Number.isFinite(v)) return 0;
  return Math.min(99, Math.max(0, v));
}

export function makeTables(count, zoneId = DEFAULT_ZONE.id) {
  const n = Math.min(40, Math.max(1, Math.floor(Number(count) || 1)));
  return Array.from({ length: n }, (_, i) => layoutTable(String(i + 1).padStart(2, "0"), i, zoneId));
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

function normalizeStockItem(raw, existing = []) {
  if (!raw || !String(raw.name ?? "").trim()) return null;
  const name = String(raw.name).trim();
  const ids = existing.map((i) => i.id);
  return {
    id: String(raw.id || slugId(name, ids)),
    name,
    unit: String(raw.unit ?? "each").trim() || "each",
    par: Math.max(0, Number(raw.par) || 0),
    category: String(raw.category ?? "").trim(),
  };
}

function normalizeStaff(raw) {
  if (!raw || !String(raw.name ?? "").trim()) return null;
  const pin = String(raw.pin ?? "").replace(/\D/g, "");
  if (pin.length < 4 || pin.length > 8) return null;
  return {
    id: String(raw.id || slugId(raw.name, [])),
    name: String(raw.name).trim(),
    pin,
    role: STAFF_ROLES.includes(raw.role) ? raw.role : "any",
    payRate: Math.max(0, roundMoney(Number(raw.payRate) || 0)),
    offDays: Array.isArray(raw.offDays)
      ? [...new Set(raw.offDays.map((n) => Number(n)).filter((d) => Number.isInteger(d) && d >= 0 && d <= 6))]
      : [],
  };
}

export function defaultVenue() {
  const zones = [DEFAULT_ZONE];
  const tables = VENUE.tables.map((id, i) => layoutTable(id, i, DEFAULT_ZONE.id));
  return {
    name: VENUE.name,
    pin: VENUE.pin,
    zones,
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
    useBookings: true,
    bookingMins: 90,
    useStock: true,
    stockItems: [],
    stockGroups: [],
    useRoster: true,
    staff: [],
    services: DEFAULT_SERVICES.map((s) => ({ ...s })),
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
  const zoneTaken = [];
  const zones = (Array.isArray(raw.zones) && raw.zones.length ? raw.zones : base.zones)
    .map((z, i) => {
      const zone = normalizeZone(z, i, zoneTaken);
      zoneTaken.push(zone.id);
      return zone;
    })
    .filter((z, i, all) => all.findIndex((x) => x.id === z.id) === i)
    .slice(0, 8);
  const fallbackZone = zones[0]?.id ?? DEFAULT_ZONE.id;
  const tables =
    Array.isArray(raw.tables) && raw.tables.length
      ? raw.tables.map((t, i) => normalizeTable(t, i, fallbackZone))
      : base.tables;
  const seen = new Set();
  const unique = [];
  for (const t of tables) {
    const key = tableKey(t.id);
    if (seen.has(key)) continue;
    seen.add(key);
    const zoneId = zones.some((z) => z.id === t.zoneId) ? t.zoneId : fallbackZone;
    unique.push({ ...t, zoneId });
  }
  const offers = Array.isArray(raw.offers) ? raw.offers.map(normalizeOffer).filter(Boolean) : base.offers;
  const stockItems = Array.isArray(raw.stockItems)
    ? raw.stockItems
        .map((i) => normalizeStockItem(i, []))
        .filter(Boolean)
        .filter((item, i, all) => all.findIndex((x) => x.id === item.id) === i)
        .slice(0, 80)
    : base.stockItems;
  const groupTaken = [];
  const inferred = [];
  for (const item of stockItems) {
    if (item.category && !inferred.includes(item.category)) inferred.push(item.category);
  }
  const stockGroups = (
    Array.isArray(raw.stockGroups) && raw.stockGroups.length
      ? raw.stockGroups
      : inferred.map((name) => ({ name }))
  )
    .map((g, i) => {
      const zone = normalizeZone(g, i, groupTaken);
      groupTaken.push(zone.id);
      return { id: zone.id, name: zone.name };
    })
    .filter((g, i, all) => all.findIndex((x) => x.id === g.id) === i)
    .slice(0, 16);
  for (const name of inferred) {
    if (!stockGroups.some((g) => tableKey(g.name) === tableKey(name))) {
      stockGroups.push(normalizeZone({ name }, stockGroups.length, stockGroups.map((g) => g.id)));
    }
  }
  const staff = Array.isArray(raw.staff)
    ? raw.staff.map(normalizeStaff).filter(Boolean).slice(0, 40)
    : base.staff;
  const services =
    Array.isArray(raw.services) && raw.services.length
      ? raw.services.map((s, i) => normalizeZone(s, i, [])).slice(0, 6)
      : base.services;
  const surchargeByDay =
    Array.isArray(raw.surchargeByDay) && raw.surchargeByDay.length === 7
      ? raw.surchargeByDay.map((n) => clampRate(Number(n), base.surchargeRate))
      : [0, 1, 2, 3, 4, 5, 6].map(() =>
          raw.surchargeRate === undefined ? base.surchargeRate : clampRate(Number(raw.surchargeRate), base.surchargeRate)
        );
  return {
    name: String(raw.name ?? base.name).trim() || base.name,
    pin: String(raw.pin ?? base.pin) || base.pin,
    zones: zones.length ? zones : base.zones,
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
    useBookings: raw.useBookings === undefined ? true : Boolean(raw.useBookings),
    bookingMins: BOOKING_MINS.includes(Number(raw.bookingMins)) ? Number(raw.bookingMins) : 90,
    useStock: raw.useStock === undefined ? true : Boolean(raw.useStock),
    stockItems,
    stockGroups,
    useRoster: raw.useRoster === undefined ? true : Boolean(raw.useRoster),
    staff,
    services,
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

export function liveZones(venue) {
  return normalizeVenue(venue).zones;
}

export function tablesInZone(venue, zoneId) {
  const records = tableRecords(venue);
  if (!zoneId || zoneId === "all") return records;
  return records.filter((t) => t.zoneId === zoneId);
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
    bookings: [],
    nextCheck: 1,
    nextChit: 1,
    nextTakeaway: 1,
    nextBooking: 1,
    nextStockOrder: 1,
    lastBumpedChitId: null,
    guestClaims: {},
    stock: { countedAt: null, qty: {}, extra: {} },
    stockOrders: [],
    shifts: [],
    clocks: [],
    onStaff: null,
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
  if (patch.useBookings !== undefined) next.useBookings = patch.useBookings;
  if (patch.bookingMins !== undefined) next.bookingMins = patch.bookingMins;
  if (patch.useStock !== undefined) next.useStock = patch.useStock;
  if (patch.useRoster !== undefined) next.useRoster = patch.useRoster;
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
  const venue = normalizeVenue(state.venue);
  if (venue.staff.some((s) => s.pin === digits)) {
    return { ok: false, error: "A person already uses that PIN. Pick another door code.", state };
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

export function addTable(state, rawId, zoneId, afterId) {
  const id = tableLabel(rawId);
  if (!id) return { ok: false, error: "Name the table the way it is on the floor — 1a, 4, 17.", state };
  const venue = normalizeVenue(state.venue);
  const clash = venue.tables.find((t) => sameTable(t.id, id));
  if (clash) {
    return { ok: false, error: `Table ${clash.id} is already on the floor.`, state };
  }
  if (venue.tables.length >= 40) return { ok: false, error: "Forty tables is the cap.", state };
  const zid = venue.zones.some((z) => z.id === zoneId) ? zoneId : venue.zones[0].id;
  const row = layoutTable(id, venue.tables.length, zid);
  const tables = [...venue.tables];
  const after = afterId ? tables.findIndex((t) => t.id === afterId) : -1;
  if (after >= 0) tables.splice(after + 1, 0, row);
  else tables.push(row);
  return { ok: true, error: null, state: updateVenue(state, { tables }) };
}

export function reorderTable(state, tableId, toIndex) {
  const venue = normalizeVenue(state.venue);
  const tables = [...venue.tables];
  const from = tables.findIndex((t) => t.id === tableId);
  if (from < 0) return { ok: false, error: "No such table.", state };
  const [row] = tables.splice(from, 1);
  const idx = Math.max(0, Math.min(tables.length, Math.floor(Number(toIndex))));
  tables.splice(idx, 0, row);
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
  const nextPatch = { ...patch };
  if (nextPatch.zoneId && !venue.zones.some((z) => z.id === nextPatch.zoneId)) {
    return { ok: false, error: "No such area.", state };
  }
  const tables = venue.tables.map((t) =>
    t.id === tableId ? normalizeTable({ ...t, ...nextPatch, id: t.id }, 0, t.zoneId) : t
  );
  return { ok: true, error: null, state: updateVenue(state, { tables }) };
}

export function renameTable(state, fromId, rawTo) {
  const toId = tableLabel(rawTo);
  if (!toId) return { ok: false, error: "Name the table the way it is on the floor — 1a, 4, 17.", state };
  const venue = normalizeVenue(state.venue);
  if (!venue.tables.some((t) => t.id === fromId)) {
    return { ok: false, error: "No such table.", state };
  }
  const clash = venue.tables.find((t) => t.id !== fromId && sameTable(t.id, toId));
  if (clash) return { ok: false, error: `Table ${clash.id} is already on the floor.`, state };
  if (fromId === toId) return { ok: true, error: null, state };
  const tables = venue.tables.map((t) => (t.id === fromId ? { ...t, id: toId } : t));
  const remap = (id) => (id === fromId ? toId : id);
  const checks = state.checks.map((c) => (c.tableId === fromId ? { ...c, tableId: toId } : c));
  const guestClaims = {};
  for (const [id, claim] of Object.entries(state.guestClaims ?? {})) {
    guestClaims[remap(id)] = claim;
  }
  const bookings = (state.bookings ?? []).map((b) => (b.tableId === fromId ? { ...b, tableId: toId } : b));
  return {
    ok: true,
    error: null,
    state: updateVenue({ ...state, checks, guestClaims, bookings }, { tables }),
  };
}

export function addZone(state, name) {
  const trimmed = String(name ?? "").trim();
  if (!trimmed) return { ok: false, error: "Name the area — Upstairs, Patio, Bar.", state };
  const venue = normalizeVenue(state.venue);
  if (venue.zones.length >= 8) return { ok: false, error: "Eight areas is the cap.", state };
  if (venue.zones.some((z) => tableKey(z.name) === tableKey(trimmed))) {
    return { ok: false, error: "That area is already on the floor.", state };
  }
  const zone = normalizeZone({ name: trimmed }, venue.zones.length, venue.zones.map((z) => z.id));
  return { ok: true, error: null, state: updateVenue(state, { zones: [...venue.zones, zone] }) };
}

export function renameZone(state, zoneId, name) {
  const trimmed = String(name ?? "").trim();
  if (!trimmed) return { ok: false, error: "Name the area.", state };
  const venue = normalizeVenue(state.venue);
  if (!venue.zones.some((z) => z.id === zoneId)) return { ok: false, error: "No such area.", state };
  const zones = venue.zones.map((z) => (z.id === zoneId ? { ...z, name: trimmed } : z));
  return { ok: true, error: null, state: updateVenue(state, { zones }) };
}

export function removeZone(state, zoneId) {
  const venue = normalizeVenue(state.venue);
  if (venue.zones.length <= 1) return { ok: false, error: "Keep at least one area.", state };
  if (!venue.zones.some((z) => z.id === zoneId)) return { ok: false, error: "No such area.", state };
  const zones = venue.zones.filter((z) => z.id !== zoneId);
  const fallback = zones[0].id;
  const tables = venue.tables.map((t) => (t.zoneId === zoneId ? { ...t, zoneId: fallback } : t));
  return { ok: true, error: null, state: updateVenue(state, { zones, tables }) };
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

export function addStockItem(state, draft) {
  const venue = normalizeVenue(state.venue);
  const item = normalizeStockItem(draft, venue.stockItems);
  if (!item) return { ok: false, error: "Name what you count — soju, kimchi, napkins.", state };
  if (venue.stockItems.length >= 80) return { ok: false, error: "Eighty lines is the cap.", state };
  if (venue.stockItems.some((i) => i.id === item.id)) item.id = `${item.id}-${venue.stockItems.length + 1}`;
  return { ok: true, error: null, state: updateVenue(state, { stockItems: [...venue.stockItems, item] }) };
}

export function patchStockItem(state, itemId, patch) {
  const venue = normalizeVenue(state.venue);
  if (!venue.stockItems.some((i) => i.id === itemId)) return { ok: false, error: "No such line.", state };
  const stockItems = venue.stockItems
    .map((i) => (i.id === itemId ? normalizeStockItem({ ...i, ...patch, id: i.id }, []) : i))
    .filter(Boolean);
  return { ok: true, error: null, state: updateVenue(state, { stockItems }) };
}

export function removeStockItem(state, itemId) {
  const venue = normalizeVenue(state.venue);
  const stock = state.stock ?? { qty: {}, extra: {} };
  const qty = { ...(stock.qty ?? {}) };
  const extra = { ...(stock.extra ?? {}) };
  delete qty[itemId];
  delete extra[itemId];
  return {
    ok: true,
    error: null,
    state: {
      ...updateVenue(state, { stockItems: venue.stockItems.filter((i) => i.id !== itemId) }),
      stock: { ...stock, qty, extra },
    },
  };
}

export function stockOnHand(state, itemId) {
  const stock = state.stock ?? {};
  return Math.max(0, (Number(stock.qty?.[itemId]) || 0) + (Number(stock.extra?.[itemId]) || 0));
}

export function setStockCount(state, itemId, qty, now = Date.now()) {
  const n = Math.max(0, Number(qty) || 0);
  const stock = state.stock ?? { qty: {}, extra: {} };
  return {
    ok: true,
    error: null,
    state: {
      ...state,
      stock: {
        countedAt: now,
        qty: { ...(stock.qty ?? {}), [itemId]: n },
        extra: { ...(stock.extra ?? {}), [itemId]: 0 },
      },
    },
  };
}

export function toBuy(state, venue) {
  return normalizeVenue(venue)
    .stockItems.map((item) => {
      const have = stockOnHand(state, item.id);
      return { ...item, have, need: Math.max(0, roundMoney(item.par - have)) };
    })
    .filter((row) => row.need > 0);
}

export function receiveStock(state, itemId, qty, now = Date.now()) {
  const add = Math.max(0, Number(qty) || 0);
  if (!add) return { ok: false, error: "How many came in?", state };
  const stock = state.stock ?? { qty: {}, extra: {} };
  const extra = { ...(stock.extra ?? {}) };
  extra[itemId] = (Number(extra[itemId]) || 0) + add;
  return {
    ok: true,
    error: null,
    state: { ...state, stock: { countedAt: stock.countedAt ?? now, qty: { ...(stock.qty ?? {}) }, extra } },
  };
}

export function placeStockOrder(state, now = Date.now()) {
  const lines = toBuy(state, state.venue).map((row) => ({
    itemId: row.id,
    name: row.name,
    unit: row.unit,
    qty: row.need,
    received: 0,
  }));
  if (!lines.length) return { ok: false, error: "Nothing to buy. Count first, or raise a par.", state };
  const order = { id: nextId("STK", state.nextStockOrder || 1), at: now, status: "open", lines };
  return {
    ok: true,
    error: null,
    state: {
      ...state,
      stockOrders: [...(state.stockOrders ?? []), order],
      nextStockOrder: (state.nextStockOrder || 1) + 1,
    },
  };
}

export function receiveOrderLine(state, orderId, itemId, qty, now = Date.now()) {
  const order = (state.stockOrders ?? []).find((o) => o.id === orderId);
  if (!order || order.status !== "open") return { ok: false, error: "No open order.", state };
  const line = order.lines.find((l) => l.itemId === itemId);
  if (!line) return { ok: false, error: "That is not on this order.", state };
  const add = qty == null ? Math.max(0, line.qty - (line.received || 0)) : Math.max(0, Number(qty) || 0);
  if (!add) return { ok: false, error: "Already in.", state };
  const received = receiveStock(state, itemId, add, now);
  if (!received.ok) return received;
  const lines = order.lines.map((l) => (l.itemId === itemId ? { ...l, received: (l.received || 0) + add } : l));
  const done = lines.every((l) => (l.received || 0) >= l.qty);
  return {
    ok: true,
    error: null,
    state: {
      ...received.state,
      stockOrders: (received.state.stockOrders ?? []).map((o) =>
        o.id === orderId ? { ...o, lines, status: done ? "done" : "open" } : o
      ),
    },
  };
}

export function stockCategories(venue) {
  return normalizeVenue(venue).stockGroups.map((g) => g.name);
}

export function addStockGroup(state, name) {
  const trimmed = String(name ?? "").trim();
  if (!trimmed) return { ok: false, error: "Name the shelf — Bar, Fridge, Dry.", state };
  const venue = normalizeVenue(state.venue);
  if (venue.stockGroups.length >= 16) return { ok: false, error: "Sixteen shelves is the cap.", state };
  if (venue.stockGroups.some((g) => tableKey(g.name) === tableKey(trimmed))) {
    return { ok: false, error: "That shelf is already there.", state };
  }
  const group = normalizeZone({ name: trimmed }, venue.stockGroups.length, venue.stockGroups.map((g) => g.id));
  return { ok: true, error: null, state: updateVenue(state, { stockGroups: [...venue.stockGroups, group] }) };
}

export function removeStockGroup(state, groupId) {
  const venue = normalizeVenue(state.venue);
  const group = venue.stockGroups.find((g) => g.id === groupId);
  if (!group) return { ok: false, error: "No such shelf.", state };
  const stockItems = venue.stockItems.map((i) =>
    tableKey(i.category) === tableKey(group.name) ? { ...i, category: "" } : i
  );
  return {
    ok: true,
    error: null,
    state: updateVenue(state, {
      stockGroups: venue.stockGroups.filter((g) => g.id !== groupId),
      stockItems,
    }),
  };
}

export function stockGrouped(items) {
  const groups = [];
  const seen = new Map();
  for (const item of items ?? []) {
    const key = item.category || "Unfiled";
    if (!seen.has(key)) {
      seen.set(key, groups.length);
      groups.push({ name: key, items: [] });
    }
    groups[seen.get(key)].items.push(item);
  }
  return groups;
}

function menuIdFromName(name, menu) {
  return slugId(
    name,
    menu.map((i) => i.id)
  );
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
  return Boolean(matchUnlock(pin, venue, null));
}

export function matchUnlock(pin, venue, staffId) {
  const digits = String(pin ?? "").replace(/\D/g, "");
  const live = normalizeVenue(venue);
  if (staffId === "till") {
    if (digits === live.pin) return { id: "till", name: "Till", role: "any" };
    return null;
  }
  if (staffId) {
    const person = live.staff.find((s) => s.id === staffId);
    if (!person || person.pin !== digits) return null;
    return { id: person.id, name: person.name, role: person.role };
  }
  const person = live.staff.find((s) => s.pin === digits);
  if (person) return { id: person.id, name: person.name, role: person.role };
  if (digits === live.pin) return { id: "till", name: "Till", role: "any" };
  return null;
}

export function addStaff(state, draft) {
  const name = String(draft.name ?? "").trim();
  if (!name) return { ok: false, error: "Name the person.", state };
  const pin = String(draft.pin ?? "").replace(/\D/g, "");
  if (pin.length < 4 || pin.length > 8) return { ok: false, error: "Their PIN must be 4–8 digits.", state };
  const venue = normalizeVenue(state.venue);
  if (pin === venue.pin) return { ok: false, error: "That is the till door code. Give them their own PIN.", state };
  if (venue.staff.some((s) => s.pin === pin)) return { ok: false, error: "Someone already has that PIN.", state };
  if (venue.staff.length >= 40) return { ok: false, error: "Forty people is the cap.", state };
  const person = normalizeStaff({ name, pin, role: draft.role, payRate: draft.payRate });
  if (!person) return { ok: false, error: "Name the person.", state };
  if (venue.staff.some((s) => s.id === person.id)) person.id = `${person.id}-${venue.staff.length + 1}`;
  return { ok: true, error: null, state: updateVenue(state, { staff: [...venue.staff, person] }) };
}

export function patchStaff(state, staffId, patch) {
  const venue = normalizeVenue(state.venue);
  if (!venue.staff.some((s) => s.id === staffId)) return { ok: false, error: "No such person.", state };
  const staff = venue.staff.map((s) => {
    if (s.id !== staffId) return s;
    return normalizeStaff({
      ...s,
      payRate: patch.payRate !== undefined ? patch.payRate : s.payRate,
      offDays: patch.offDays !== undefined ? patch.offDays : s.offDays,
      pin: s.pin,
      name: patch.name !== undefined ? patch.name : s.name,
      role: patch.role !== undefined ? patch.role : s.role,
    });
  });
  if (staff.some((s) => !s)) return { ok: false, error: "Name the person.", state };
  return { ok: true, error: null, state: updateVenue(state, { staff }) };
}

export function toggleOffDay(state, staffId, day) {
  const venue = normalizeVenue(state.venue);
  const person = venue.staff.find((s) => s.id === staffId);
  if (!person) return { ok: false, error: "No such person.", state };
  const d = Number(day);
  if (!Number.isInteger(d) || d < 0 || d > 6) return { ok: false, error: "Pick a day.", state };
  const offDays = person.offDays.includes(d) ? person.offDays.filter((x) => x !== d) : [...person.offDays, d];
  return patchStaff(state, staffId, { offDays });
}

export function removeStaff(state, staffId) {
  const venue = normalizeVenue(state.venue);
  return {
    ok: true,
    error: null,
    state: {
      ...updateVenue(state, { staff: venue.staff.filter((s) => s.id !== staffId) }),
      shifts: (state.shifts ?? []).filter((s) => s.staffId !== staffId),
    },
  };
}

export function addService(state, name) {
  const trimmed = String(name ?? "").trim();
  if (!trimmed) return { ok: false, error: "Name the service — Lunch, Dinner, Arvo.", state };
  const venue = normalizeVenue(state.venue);
  if (venue.services.length >= 6) return { ok: false, error: "Six services is the cap.", state };
  if (venue.services.some((s) => tableKey(s.name) === tableKey(trimmed))) {
    return { ok: false, error: "That service is already on the week.", state };
  }
  const service = normalizeZone({ name: trimmed }, venue.services.length, venue.services.map((s) => s.id));
  return { ok: true, error: null, state: updateVenue(state, { services: [...venue.services, service] }) };
}

export function removeService(state, serviceId) {
  const venue = normalizeVenue(state.venue);
  if (venue.services.length <= 1) return { ok: false, error: "Keep at least one service.", state };
  return {
    ok: true,
    error: null,
    state: {
      ...updateVenue(state, { services: venue.services.filter((s) => s.id !== serviceId) }),
      shifts: (state.shifts ?? []).filter((s) => s.serviceId !== serviceId),
    },
  };
}

export function toggleShift(state, staffId, day, serviceId) {
  const venue = normalizeVenue(state.venue);
  if (!venue.staff.some((s) => s.id === staffId)) return { ok: false, error: "No such person.", state };
  if (!venue.services.some((s) => s.id === serviceId)) return { ok: false, error: "No such service.", state };
  const d = Number(day);
  if (!Number.isInteger(d) || d < 0 || d > 6) return { ok: false, error: "Pick a day.", state };
  const shifts = [...(state.shifts ?? [])];
  const idx = shifts.findIndex((s) => s.staffId === staffId && s.day === d && s.serviceId === serviceId);
  if (idx >= 0) shifts.splice(idx, 1);
  else shifts.push({ staffId, day: d, serviceId });
  return { ok: true, error: null, state: { ...state, shifts } };
}

export function rosterOn(state, day, serviceId) {
  const ids = (state.shifts ?? [])
    .filter((s) => s.day === day && s.serviceId === serviceId)
    .map((s) => s.staffId);
  const venue = normalizeVenue(state.venue);
  return venue.staff.filter((p) => ids.includes(p.id));
}

const CLOCK_KEEP_MS = 90 * 24 * 60 * 60 * 1000;
const CLOCK_CAP = 400;

export function normalizePunch(raw) {
  if (!raw || raw.staffId == null || raw.inAt == null) return null;
  const breaks = Array.isArray(raw.breaks)
    ? raw.breaks
        .filter((b) => b && b.inAt != null)
        .map((b) => ({ inAt: Number(b.inAt), outAt: b.outAt == null ? null : Number(b.outAt) }))
    : [];
  return {
    staffId: String(raw.staffId),
    inAt: Number(raw.inAt),
    outAt: raw.outAt == null ? null : Number(raw.outAt),
    breaks,
  };
}

function liveClocks(clocks) {
  return (clocks ?? []).map(normalizePunch).filter(Boolean).slice(-CLOCK_CAP);
}

function keepClocks(clocks, now = Date.now()) {
  return liveClocks(clocks).filter((c) => now - c.inAt < CLOCK_KEEP_MS);
}

function closeBreaks(punch, now) {
  return {
    ...punch,
    breaks: (punch.breaks ?? []).map((b) => (b.outAt == null ? { ...b, outAt: now } : b)),
  };
}

export function openBreak(clock) {
  const punch = normalizePunch(clock);
  return punch?.breaks.find((b) => b.outAt == null) ?? null;
}

export function breakMs(clock, now = Date.now()) {
  const punch = normalizePunch(clock);
  if (!punch) return 0;
  return punch.breaks.reduce((sum, b) => {
    const end = b.outAt ?? punch.outAt ?? now;
    return sum + Math.max(0, end - b.inAt);
  }, 0);
}

export function workedMs(clock, now = Date.now()) {
  const punch = normalizePunch(clock);
  if (!punch) return 0;
  const end = punch.outAt ?? now;
  return Math.max(0, end - punch.inAt - breakMs(punch, now));
}

export function startOfWeek(at) {
  const d = new Date(at);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - d.getDay());
  return d.getTime();
}

export function payDue(hours, rate) {
  return roundMoney(Math.max(0, Number(hours) || 0) * Math.max(0, Number(rate) || 0));
}

export function weekSheet(state, venue, at = Date.now()) {
  const from = startOfWeek(at);
  const to = from + 7 * 24 * 60 * 60 * 1000;
  const live = normalizeVenue(venue);
  return live.staff.map((person) => {
    const punches = liveClocks(state.clocks).filter((c) => c.staffId === person.id && c.inAt >= from && c.inAt < to);
    const ms = punches.reduce((sum, c) => sum + workedMs(c, at), 0);
    const hours = Math.round((ms / 3600000) * 100) / 100;
    return {
      id: person.id,
      name: person.name,
      payRate: person.payRate,
      hours,
      pay: payDue(hours, person.payRate),
      punches,
      open: punches.some((c) => c.outAt == null),
      onBreak: punches.some((c) => c.outAt == null && openBreak(c)),
    };
  });
}

export function clockIn(state, staff, now = Date.now()) {
  if (!staff?.id) return { ok: false, error: "Who is this?", state };
  const onStaff = { id: staff.id, name: staff.name, role: staff.role ?? "any", at: now };
  if (staff.id === "till") {
    return { ok: true, error: null, state: { ...state, onStaff } };
  }
  const clocks = liveClocks(state.clocks).map((c) =>
    c.staffId === staff.id && !c.outAt ? { ...closeBreaks(c, now), outAt: now } : c
  );
  clocks.push({ staffId: staff.id, inAt: now, outAt: null, breaks: [] });
  return {
    ok: true,
    error: null,
    state: {
      ...state,
      onStaff,
      clocks: liveClocks(clocks),
    },
  };
}

export function clockOut(state, now = Date.now()) {
  const id = state.onStaff?.id;
  const clocks = liveClocks(state.clocks).map((c) =>
    id && c.staffId === id && !c.outAt ? { ...closeBreaks(c, now), outAt: now } : c
  );
  return { ok: true, error: null, state: { ...state, onStaff: null, clocks } };
}

export function openClock(state, staffId) {
  return liveClocks(state.clocks).find((c) => c.staffId === staffId && !c.outAt) ?? null;
}

export function whoIsClocked(state, venue) {
  const ids = [...new Set(liveClocks(state.clocks).filter((c) => !c.outAt).map((c) => c.staffId))];
  return normalizeVenue(venue).staff.filter((p) => ids.includes(p.id));
}

export function punchIn(state, staff, now = Date.now()) {
  if (!staff?.id || staff.id === "till") return { ok: false, error: "Clock in as a person.", state };
  const clocks = liveClocks(state.clocks).map((c) =>
    c.staffId === staff.id && !c.outAt ? { ...closeBreaks(c, now), outAt: now } : c
  );
  clocks.push({ staffId: staff.id, inAt: now, outAt: null, breaks: [] });
  return { ok: true, error: null, state: { ...state, clocks: liveClocks(clocks) } };
}

export function punchOut(state, staffId, now = Date.now()) {
  if (!staffId || staffId === "till") return { ok: false, error: "Clock out as a person.", state };
  if (!openClock(state, staffId)) return { ok: false, error: "Already out.", state };
  const clocks = liveClocks(state.clocks).map((c) =>
    c.staffId === staffId && !c.outAt ? { ...closeBreaks(c, now), outAt: now } : c
  );
  const onStaff = state.onStaff?.id === staffId ? null : state.onStaff;
  return { ok: true, error: null, state: { ...state, clocks, onStaff } };
}

export function startBreak(state, staffId, now = Date.now()) {
  const open = openClock(state, staffId);
  if (!open) return { ok: false, error: "Clock in first.", state };
  if (openBreak(open)) return { ok: false, error: "Already on break.", state };
  const clocks = liveClocks(state.clocks).map((c) =>
    c.staffId === staffId && !c.outAt ? { ...c, breaks: [...c.breaks, { inAt: now, outAt: null }] } : c
  );
  return { ok: true, error: null, state: { ...state, clocks } };
}

export function endBreak(state, staffId, now = Date.now()) {
  const open = openClock(state, staffId);
  if (!open) return { ok: false, error: "Clock in first.", state };
  if (!openBreak(open)) return { ok: false, error: "Not on break.", state };
  const clocks = liveClocks(state.clocks).map((c) =>
    c.staffId === staffId && !c.outAt ? closeBreaks(c, now) : c
  );
  return { ok: true, error: null, state: { ...state, clocks } };
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
    guestName:
      channel === "takeaway"
        ? guestName
        : guestName?.trim()
          ? guestName.trim()
          : state.guestClaims?.[tableId]?.name ?? null,
    guestPhone: guestPhone?.trim() ? guestPhone.trim() : null,
    guestEmail: guestEmail?.trim() ? guestEmail.trim() : null,
    status: "open",
    lines: lines.map((l) => ({ ...l })),
    paidVia: null,
    covers: channel === "dine-in" ? clampCovers(covers ?? state.guestClaims?.[tableId]?.covers) : 0,
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

export function endNight(state, now = Date.now()) {
  const venue = normalizeVenue(state.venue);
  let receipts = [...(state.receipts ?? [])];
  for (const check of state.checks.filter((c) => c.status === "paid")) {
    if (!receipts.some((r) => r.id === check.id)) {
      receipts = [makeReceipt(check, venue, check.closedAt ?? now), ...receipts];
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
      chits: state.chits.filter((c) => c.checkId && keepIds.has(c.checkId)),
      receipts: receipts.slice(0, 200),
      lastBumpedChitId,
      guestClaims: {},
      bookings: pruneBookings(state.bookings ?? [], now),
      clocks: keepClocks(state.clocks, now),
    },
  };
}

export function holdMs(venue) {
  const mins = Number(normalizeVenue(venue).bookingMins);
  return (BOOKING_MINS.includes(mins) ? mins : 90) * 60 * 1000;
}

export function startOfLocalDay(at) {
  const d = new Date(at);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export function formatClock(at) {
  const d = new Date(at);
  const h = d.getHours();
  const m = String(d.getMinutes()).padStart(2, "0");
  const h12 = ((h + 11) % 12) + 1;
  const ap = h < 12 ? "am" : "pm";
  return m === "00" ? `${h12}${ap}` : `${h12}:${m}${ap}`;
}

export function daySlots(at, fromHour = 11, toHour = 22, stepMin = 15) {
  const start = startOfLocalDay(at);
  const slots = [];
  for (let m = fromHour * 60; m <= toHour * 60; m += stepMin) {
    slots.push(start + m * 60 * 1000);
  }
  return slots;
}

export function defaultBookSlot(now) {
  const start = startOfLocalDay(now);
  const minutes = new Date(now).getHours() * 60 + new Date(now).getMinutes();
  const rounded = Math.ceil((minutes + 1) / 15) * 15;
  if (rounded < 11 * 60) return start + 18 * 60 * 60 * 1000;
  if (rounded > 22 * 60) return start + 24 * 60 * 60 * 1000 + 18 * 60 * 60 * 1000;
  return start + rounded * 60 * 1000;
}

function pad2(n) {
  return String(n).padStart(2, "0");
}

export function dateValue(at) {
  const d = new Date(at);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

export function timeValue(at) {
  const d = new Date(at);
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

export function fromDateAndTime(dateStr, timeStr) {
  const [y, m, day] = String(dateStr ?? "")
    .split("-")
    .map(Number);
  const [h, min] = String(timeStr || "18:00")
    .split(":")
    .map(Number);
  if (!y || !m || !day) return null;
  const at = new Date(y, m - 1, day, h || 0, min || 0, 0, 0).getTime();
  return Number.isFinite(at) ? at : null;
}

export function shiftMonth(at, delta) {
  const d = new Date(startOfLocalDay(at));
  d.setDate(1);
  d.setMonth(d.getMonth() + delta);
  return d.getTime();
}

export function monthGrid(at) {
  const d = new Date(startOfLocalDay(at));
  d.setDate(1);
  const year = d.getFullYear();
  const month = d.getMonth();
  const firstDow = d.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < firstDow; i += 1) cells.push(null);
  for (let day = 1; day <= daysInMonth; day += 1) {
    cells.push(new Date(year, month, day).getTime());
  }
  return { year, month, label: d.toLocaleDateString(undefined, { month: "long", year: "numeric" }), cells };
}

export function formatDay(at) {
  return new Date(at).toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" });
}

function isOpenBooking(b) {
  return b && b.status === "booked";
}

export function bookingsOverlap(a, b, windowMs) {
  if (!isOpenBooking(a) || !isOpenBooking(b)) return false;
  if (!a.tableId || !b.tableId || a.tableId !== b.tableId) return false;
  return Math.abs(Number(a.at) - Number(b.at)) < windowMs;
}

export function heldOnTable(state, tableId, at, exceptId) {
  const venue = normalizeVenue(state.venue);
  const windowMs = holdMs(venue);
  return (state.bookings ?? []).find(
    (b) => b.id !== exceptId && isOpenBooking(b) && b.tableId === tableId && Math.abs(b.at - at) < windowMs
  ) ?? null;
}

export function bookingAtTable(state, tableId, at) {
  const venue = normalizeVenue(state.venue);
  const windowMs = holdMs(venue);
  const grace = 15 * 60 * 1000;
  return (
    (state.bookings ?? []).find(
      (b) =>
        isOpenBooking(b) &&
        b.tableId === tableId &&
        at >= b.at - grace &&
        at < b.at + windowMs
    ) ?? null
  );
}

export function nextBookingForTable(state, tableId, now) {
  const start = startOfLocalDay(now);
  const end = start + 24 * 60 * 60 * 1000;
  return (
    (state.bookings ?? [])
      .filter(
        (b) =>
          isOpenBooking(b) &&
          b.tableId === tableId &&
          b.at >= now - 30 * 60 * 1000 &&
          b.at < end
      )
      .sort((a, b) => a.at - b.at)[0] ?? null
  );
}

export function tonightBookings(bookings, at) {
  const start = startOfLocalDay(at);
  const end = start + 24 * 60 * 60 * 1000;
  return (bookings ?? [])
    .filter((b) => b.at >= start && b.at < end && b.status !== "cancelled")
    .slice()
    .sort((a, b) => a.at - b.at || String(a.name).localeCompare(String(b.name)));
}

export function partyOnTable(state, tableId, at = Date.now()) {
  if (!tableId) return null;
  const bookings = state.bookings ?? [];
  const seated = [...bookings].reverse().find((b) => b.tableId === tableId && b.status === "seated");
  if (seated) return seated;
  const claim = state.guestClaims?.[tableId];
  if (claim?.bookingId) {
    const linked = bookings.find((b) => b.id === claim.bookingId);
    if (linked) return linked;
  }
  const hold = bookingAtTable(state, tableId, at);
  if (hold) return hold;
  if (claim) {
    return {
      id: null,
      name: claim.name || "Walk-in",
      covers: claim.covers || 0,
      phone: claim.phone || "",
      note: "",
      tableId,
      at: claim.at,
      status: guestClaimStatus(claim) === "accepted" ? "seated" : "booked",
      walkIn: true,
    };
  }
  return null;
}

export function partyTag(state, party) {
  if (!party) return null;
  if (party.status === "no-show") return { label: "No show", kind: "muted" };
  if (party.status === "cancelled") return { label: "Cancelled", kind: "muted" };
  if (party.status === "booked") return { label: "Booked", kind: "booked" };
  const open = party.tableId ? openCheckForTable(state.checks, party.tableId) : null;
  if (open) {
    if (open.status === "paid") return { label: "Paid", kind: "paid" };
    const paid = amountPaid(open) ?? 0;
    if (paid > 0) return { label: "Part paid", kind: "eating" };
    return { label: "On the table", kind: "eating" };
  }
  const last = party.tableId ? lastPaidCheckForTable(state.checks, party.tableId) : null;
  if (last && party.status === "seated") return { label: "Paid", kind: "paid" };
  if (party.status === "seated") return { label: "Here", kind: "here" };
  return { label: "Booked", kind: "booked" };
}

function pruneBookings(bookings, now) {
  const week = 7 * 24 * 60 * 60 * 1000;
  const tomorrow = startOfLocalDay(now) + 24 * 60 * 60 * 1000;
  return (bookings ?? [])
    .filter((b) => {
      if (b.status === "booked" && b.at >= startOfLocalDay(now)) return true;
      if (b.status === "booked" && b.at >= tomorrow) return true;
      return now - Number(b.seatedAt || b.at) < week;
    })
    .slice(-200);
}

export function addBooking(state, draft) {
  const name = String(draft.name ?? "").trim();
  if (!name) return { ok: false, error: "Whose name is the book under?", state };
  const covers = clampCovers(draft.covers);
  if (covers < 1) return { ok: false, error: "How many guests?", state };
  const at = Number(draft.at);
  if (!Number.isFinite(at) || at <= 0) return { ok: false, error: "Pick a time.", state };
  const venue = normalizeVenue(state.venue);
  let tableId = null;
  if (draft.tableId) {
    tableId = normalizeTableId(draft.tableId, liveTables(venue));
    if (!tableId) return { ok: false, error: "No such table.", state };
    const clash = heldOnTable(state, tableId, at);
    if (clash) return { ok: false, error: `Table ${tableId} is already held for ${clash.name}.`, state };
  }
  const booking = {
    id: nextId("BK", state.nextBooking || 1),
    name,
    covers,
    phone: String(draft.phone ?? "").trim(),
    note: String(draft.note ?? "").trim(),
    tableId,
    at,
    status: "booked",
    seatedAt: null,
  };
  return {
    ok: true,
    error: null,
    state: {
      ...state,
      bookings: [...(state.bookings ?? []), booking],
      nextBooking: (state.nextBooking || 1) + 1,
    },
  };
}

export function patchBooking(state, bookingId, patch) {
  const current = (state.bookings ?? []).find((b) => b.id === bookingId);
  if (!current) return { ok: false, error: "No such booking.", state };
  if (current.status !== "booked") return { ok: false, error: "That booking is already closed.", state };
  const next = { ...current };
  if (patch.name !== undefined) {
    const name = String(patch.name).trim();
    if (!name) return { ok: false, error: "Whose name is the book under?", state };
    next.name = name;
  }
  if (patch.covers !== undefined) {
    const covers = clampCovers(patch.covers);
    if (covers < 1) return { ok: false, error: "How many guests?", state };
    next.covers = covers;
  }
  if (patch.phone !== undefined) next.phone = String(patch.phone).trim();
  if (patch.note !== undefined) next.note = String(patch.note).trim();
  if (patch.at !== undefined) {
    const at = Number(patch.at);
    if (!Number.isFinite(at) || at <= 0) return { ok: false, error: "Pick a time.", state };
    next.at = at;
  }
  if (patch.tableId !== undefined) {
    if (!patch.tableId) {
      next.tableId = null;
    } else {
      const tableId = normalizeTableId(patch.tableId, liveTables(state.venue));
      if (!tableId) return { ok: false, error: "No such table.", state };
      next.tableId = tableId;
    }
  }
  if (next.tableId) {
    const clash = heldOnTable(state, next.tableId, next.at, bookingId);
    if (clash) return { ok: false, error: `Table ${next.tableId} is already held for ${clash.name}.`, state };
  }
  return {
    ok: true,
    error: null,
    state: {
      ...state,
      bookings: (state.bookings ?? []).map((b) => (b.id === bookingId ? next : b)),
    },
  };
}

export function cancelBooking(state, bookingId) {
  const current = (state.bookings ?? []).find((b) => b.id === bookingId);
  if (!current || current.status !== "booked") return { ok: false, error: "Nothing to cancel.", state };
  return {
    ok: true,
    error: null,
    state: {
      ...state,
      bookings: (state.bookings ?? []).map((b) => (b.id === bookingId ? { ...b, status: "cancelled" } : b)),
    },
  };
}

export function markNoShow(state, bookingId) {
  const current = (state.bookings ?? []).find((b) => b.id === bookingId);
  if (!current || current.status !== "booked") return { ok: false, error: "Nothing to mark.", state };
  return {
    ok: true,
    error: null,
    state: {
      ...state,
      bookings: (state.bookings ?? []).map((b) => (b.id === bookingId ? { ...b, status: "no-show" } : b)),
    },
  };
}

export function seatBooking(state, bookingId, now = Date.now()) {
  const current = (state.bookings ?? []).find((b) => b.id === bookingId);
  if (!current || current.status !== "booked") return { ok: false, error: "Nothing to seat.", state };
  if (!current.tableId) return { ok: false, error: "Hold a table first.", state };
  const ids = liveTables(state.venue);
  const claimed = claimTable(state, current.tableId, ids, now);
  if (!claimed.ok) return claimed;
  const seated = acceptClaim(claimed.state, current.tableId);
  if (!seated.ok) return seated;
  const guestClaims = {
    ...seated.state.guestClaims,
    [current.tableId]: {
      ...seated.state.guestClaims[current.tableId],
      covers: current.covers,
      name: current.name,
      phone: current.phone,
      bookingId: current.id,
    },
  };
  return {
    ok: true,
    error: null,
    state: {
      ...seated.state,
      guestClaims,
      bookings: (state.bookings ?? []).map((b) =>
        b.id === bookingId ? { ...b, status: "seated", seatedAt: now } : b
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
  const bits = [`Table ${check.tableId}`];
  if (check.guestName) bits.push(check.guestName);
  const covers = Number(check.covers) || 0;
  if (covers > 0) bits.push(String(covers));
  return bits.join(" · ");
}

export function nextQueueNumber(n) {
  return `T-${String(n).padStart(2, "0")}`;
}

export function normalizeTableId(raw, tables) {
  const ids = tableIds(tables);
  const typed = String(raw ?? "")
    .trim()
    .replace(/\s+/g, "");
  if (!typed) return null;
  const exact = ids.find((id) => tableKey(id) === tableKey(typed));
  if (exact) return exact;
  const n = numericTableKey(typed);
  if (n == null) return null;
  const hits = ids.filter((id) => numericTableKey(id) === n);
  return hits.length === 1 ? hits[0] : null;
}

export function claimTable(state, tableId, tables, now) {
  const canonical = normalizeTableId(tableId, tables);
  if (!canonical) {
    return { ok: false, error: "Unknown table.", state };
  }
  const existing = state.guestClaims?.[canonical];
  const status = guestClaimStatus(existing) === "accepted" ? "accepted" : "pending";
  return {
    ok: true,
    error: null,
    state: {
      ...state,
      guestClaims: { ...(state.guestClaims ?? {}), [canonical]: { ...existing, at: now, status } },
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

  const bookings = (state.bookings ?? []).map((b) =>
    b.status === "seated" && b.tableId === fromTableId ? { ...b, tableId: toTableId } : b
  );

  return { ok: true, error: null, state: { ...state, checks, chits, guestClaims, bookings } };
}

export const LATE_MS = 8 * 60 * 1000;
export const NEW_CHIT_MS = 4000;
