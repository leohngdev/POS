import { createContext, useContext, useEffect, useMemo, useReducer, useRef, useState } from "react";
import {
  createInitialState,
  send,
  payCheck,
  bumpChit,
  undoLastBump,
  updateVenueTaxes,
  setVenueName,
  setPin,
  setTableCount,
  addMenuItem,
  patchMenuItem,
  setCheckCovers,
  setCheckDiscount,
  endNight,
  claimTable,
  rejectClaim,
  releaseClaim,
  acceptClaim,
  moveTable,
  voidLastSend,
  liveTables,
  normalizeVenue,
  addTable,
  removeTable,
  patchTable,
  renameTable,
  reorderTable,
  addZone,
  renameZone,
  removeZone,
  addOffer,
  removeOffer,
  applyCheckOffer,
  removeCheckOffer,
  addBooking,
  patchBooking,
  cancelBooking,
  markNoShow,
  seatBooking,
  addStockItem,
  patchStockItem,
  removeStockItem,
  setStockCount,
  receiveStock,
  placeStockOrder,
  receiveOrderLine,
  matchUnlock,
  isBoss,
  clockIn,
  clockOut,
  punchIn as punchClockIn,
  punchOut as punchClockOut,
  startBreak,
  endBreak,
  openBreak,
  openClock,
  patchStaff,
  toggleOffDay,
  addStaff,
  removeStaff,
  addService,
  removeService,
  toggleShift,
  addStockGroup,
  removeStockGroup,
} from "../../services/pos";
import { loadState, writeStore, STORAGE_KEY, toSnapshot } from "../../services/persist";
import { applyOnVenue, hasLocalService, POLL_MS, pullSnapshot, pushSnapshot, sessionize } from "../../services/sync";

const PosContext = createContext(null);

function reducer(state, action) {
  switch (action.type) {
    case "unlock-fail":
      return { ...state, pinError: "Wrong PIN" };
    case "replace":
      return action.state;
    case "hydrate-remote":
      return { ...action.state, unlocked: state.unlocked, pinError: state.pinError, onStaff: state.onStaff ?? action.state.onStaff ?? null };
    default:
      return state;
  }
}

function boot() {
  if (typeof localStorage === "undefined") return createInitialState();
  return loadState(createInitialState(), localStorage);
}

function fromStore(session) {
  if (typeof localStorage === "undefined") return session;
  const loaded = loadState(createInitialState(), localStorage);
  return { ...loaded, unlocked: session.unlocked, pinError: session.pinError, onStaff: session.onStaff ?? null };
}

function tablesOf(state) {
  return liveTables(state.venue);
}

export function PosProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, null, boot);
  const [syncStatus, setSyncStatus] = useState("local");
  const revRef = useRef(0);
  const mutatingRef = useRef(false);

  useEffect(() => {
    if (typeof localStorage === "undefined") return;
    writeStore(state, localStorage);
  }, [state]);

  useEffect(() => {
    function onStorage(event) {
      if (event.key !== STORAGE_KEY) return;
      const next = loadState(createInitialState(), localStorage);
      dispatch({ type: "hydrate-remote", state: next });
    }
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function tick() {
      if (mutatingRef.current) return;
      const pulled = await pullSnapshot();
      if (cancelled || mutatingRef.current) return;
      if (!pulled.ok) {
        setSyncStatus("local");
        return;
      }
      setSyncStatus("live");
      if (!pulled.snapshot) {
        const local = fromStore(state);
        if (hasLocalService(local) && pulled.rev === 0) {
          mutatingRef.current = true;
          const seeded = await pushSnapshot(0, toSnapshot(local));
          mutatingRef.current = false;
          if (cancelled) return;
          if (seeded.ok) revRef.current = seeded.rev;
        }
        return;
      }
      if (pulled.rev <= revRef.current) return;
      revRef.current = pulled.rev;
      dispatch({ type: "hydrate-remote", state: sessionize(pulled.snapshot, state) });
    }

    tick();
    const id = setInterval(tick, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  const venue = useMemo(() => normalizeVenue(state.venue), [state.venue]);

  useEffect(() => {
    const mins = Number(venue.lockMins) || 0;
    if (!mins || !state.unlocked) return undefined;
    let timer;
    function arm() {
      clearTimeout(timer);
      timer = setTimeout(() => {
        const next = { ...clockOut(fromStore(state), Date.now()).state, unlocked: false, pinError: null };
        dispatch({ type: "replace", state: next });
        mutatingRef.current = true;
        pushSnapshot(revRef.current, toSnapshot(next))
          .then((pushed) => {
            if (pushed.ok) revRef.current = pushed.rev;
          })
          .finally(() => {
            mutatingRef.current = false;
          });
      }, mins * 60 * 1000);
    }
    arm();
    window.addEventListener("pointerdown", arm);
    window.addEventListener("keydown", arm);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("pointerdown", arm);
      window.removeEventListener("keydown", arm);
    };
  }, [state.unlocked, venue.lockMins]);

  async function withSync(apply) {
    mutatingRef.current = true;
    try {
      const applied = await applyOnVenue(apply, { ...state, rev: revRef.current }, fromStore(state), {
        pull: pullSnapshot,
        push: pushSnapshot,
      });
      revRef.current = applied.rev;
      setSyncStatus(applied.status);
      dispatch({ type: "replace", state: applied.next });
      return applied.result;
    } finally {
      mutatingRef.current = false;
    }
  }

  function bossSync(apply) {
    return withSync((latest) => {
      if (!isBoss(latest.onStaff)) {
        return { ok: false, error: "That's for the till door.", state: latest };
      }
      return apply(latest);
    });
  }

  const api = {
    state,
    venue,
    syncStatus,
    unlock(pin, staffId) {
      mutatingRef.current = true;
      pullSnapshot()
        .then((pulled) => {
          let base = fromStore(state);
          if (pulled.ok && pulled.snapshot) {
            base = sessionize(pulled.snapshot, state);
            revRef.current = pulled.rev;
            setSyncStatus("live");
          } else if (pulled.ok) {
            setSyncStatus("live");
          } else {
            setSyncStatus("local");
          }
          const who = matchUnlock(pin, base.venue, staffId);
          if (!who) {
            dispatch({ type: "unlock-fail" });
            return;
          }
          const clocked = clockIn(base, who, Date.now());
          const next = { ...clocked.state, unlocked: true, pinError: null };
          dispatch({ type: "replace", state: next });
          if (pulled.ok) {
            return pushSnapshot(revRef.current, toSnapshot(next)).then((pushed) => {
              if (pushed.ok) revRef.current = pushed.rev;
            });
          }
          return undefined;
        })
        .finally(() => {
          mutatingRef.current = false;
        });
    },
    lock() {
      const next = { ...clockOut(state, Date.now()).state, unlocked: false, pinError: null };
      dispatch({ type: "replace", state: next });
      mutatingRef.current = true;
      pushSnapshot(revRef.current, toSnapshot(next))
        .then((pushed) => {
          if (pushed.ok) revRef.current = pushed.rev;
        })
        .finally(() => {
          mutatingRef.current = false;
        });
    },
    sendOrder(payload) {
      return withSync((latest) => send({ state: latest, venue: normalizeVenue(latest.venue), now: Date.now(), ...payload }));
    },
    pay(checkId, paidVia, amount) {
      return withSync((latest) => payCheck(latest, checkId, paidVia, amount));
    },
    bump(chitId) {
      return withSync((latest) => bumpChit(latest, chitId, Date.now()));
    },
    undoBump() {
      return withSync((latest) => undoLastBump(latest));
    },
    setVenueTaxes(patch) {
      return bossSync((latest) => ({ ok: true, error: null, state: updateVenueTaxes(latest, patch) }));
    },
    renameVenue(name) {
      return bossSync((latest) => setVenueName(latest, name));
    },
    changePin(pin) {
      return bossSync((latest) => setPin(latest, pin));
    },
    changeTableCount(count) {
      return bossSync((latest) => setTableCount(latest, count));
    },
    addFloorTable(id, zoneId, afterId) {
      return bossSync((latest) => addTable(latest, id, zoneId, afterId));
    },
    removeFloorTable(id) {
      return bossSync((latest) => removeTable(latest, id));
    },
    moveFloorTable(id, patch) {
      return bossSync((latest) => patchTable(latest, id, patch));
    },
    renameFloorTable(id, next) {
      return bossSync((latest) => renameTable(latest, id, next));
    },
    reorderFloorTable(id, toIndex) {
      return bossSync((latest) => reorderTable(latest, id, toIndex));
    },
    addFloorZone(name) {
      return bossSync((latest) => addZone(latest, name));
    },
    renameFloorZone(id, name) {
      return bossSync((latest) => renameZone(latest, id, name));
    },
    removeFloorZone(id) {
      return bossSync((latest) => removeZone(latest, id));
    },
    addDish(item) {
      return bossSync((latest) => addMenuItem(latest, item));
    },
    patchDish(itemId, patch) {
      return bossSync((latest) => patchMenuItem(latest, itemId, patch));
    },
    addVenueOffer(draft) {
      return bossSync((latest) => addOffer(latest, draft));
    },
    removeVenueOffer(id) {
      return bossSync((latest) => removeOffer(latest, id));
    },
    setCovers(checkId, covers) {
      return withSync((latest) => setCheckCovers(latest, checkId, covers));
    },
    setDiscount(checkId, rate) {
      return withSync((latest) => setCheckDiscount(latest, checkId, rate));
    },
    addCheckOffer(checkId, offer) {
      return withSync((latest) => applyCheckOffer(latest, checkId, offer));
    },
    dropCheckOffer(checkId, offerId) {
      return withSync((latest) => removeCheckOffer(latest, checkId, offerId));
    },
    closeNight() {
      return bossSync((latest) => endNight(latest));
    },
    book(draft) {
      return bossSync((latest) => addBooking(latest, draft));
    },
    holdTable(bookingId, tableId) {
      return bossSync((latest) => patchBooking(latest, bookingId, { tableId }));
    },
    seat(bookingId) {
      return bossSync((latest) => seatBooking(latest, bookingId, Date.now()));
    },
    cancelBook(bookingId) {
      return bossSync((latest) => cancelBooking(latest, bookingId));
    },
    noShow(bookingId) {
      return bossSync((latest) => markNoShow(latest, bookingId));
    },
    addStockLine(draft) {
      return bossSync((latest) => addStockItem(latest, draft));
    },
    patchStockLine(id, patch) {
      return bossSync((latest) => patchStockItem(latest, id, patch));
    },
    dropStockLine(id) {
      return bossSync((latest) => removeStockItem(latest, id));
    },
    countStock(id, qty) {
      return withSync((latest) => setStockCount(latest, id, qty, Date.now()));
    },
    receiveLine(id, qty) {
      return bossSync((latest) => receiveStock(latest, id, qty, Date.now()));
    },
    orderStock() {
      return bossSync((latest) => placeStockOrder(latest, Date.now()));
    },
    takeOrderLine(orderId, itemId) {
      return bossSync((latest) => receiveOrderLine(latest, orderId, itemId, undefined, Date.now()));
    },
    punchIn(pin, staffId) {
      return withSync((latest) => {
        const who = matchUnlock(pin, latest.venue, staffId);
        if (!who || who.id === "till") return { ok: false, error: "Use your own PIN.", state: latest };
        return punchClockIn(latest, who, Date.now());
      });
    },
    punchOut(pin, staffId) {
      return withSync((latest) => {
        const who = matchUnlock(pin, latest.venue, staffId);
        if (!who || who.id === "till") return { ok: false, error: "Use your own PIN.", state: latest };
        return punchClockOut(latest, who.id, Date.now());
      });
    },
    punchBreak(pin, staffId) {
      return withSync((latest) => {
        const who = matchUnlock(pin, latest.venue, staffId);
        if (!who || who.id === "till") return { ok: false, error: "Use your own PIN.", state: latest };
        const open = openClock(latest, who.id);
        if (!open) return { ok: false, error: "Clock in first.", state: latest };
        if (openBreak(open)) return endBreak(latest, who.id, Date.now());
        return startBreak(latest, who.id, Date.now());
      });
    },
    patchPerson(id, patch) {
      return bossSync((latest) => patchStaff(latest, id, patch));
    },
    flipOff(staffId, day) {
      return bossSync((latest) => toggleOffDay(latest, staffId, day));
    },
    flipOwnOff(staffId, day) {
      return withSync((latest) => toggleOffDay(latest, staffId, day));
    },
    addPerson(draft) {
      return bossSync((latest) => addStaff(latest, draft));
    },
    dropPerson(id) {
      return bossSync((latest) => removeStaff(latest, id));
    },
    addMeal(name) {
      return bossSync((latest) => addService(latest, name));
    },
    dropMeal(id) {
      return bossSync((latest) => removeService(latest, id));
    },
    flipShift(staffId, day, serviceId) {
      return bossSync((latest) => toggleShift(latest, staffId, day, serviceId));
    },
    addShelf(name) {
      return bossSync((latest) => addStockGroup(latest, name));
    },
    dropShelf(id) {
      return bossSync((latest) => removeStockGroup(latest, id));
    },
    claim(tableId) {
      return withSync((latest) => claimTable(latest, tableId, tablesOf(latest), Date.now()));
    },
    release(tableId) {
      return withSync((latest) => releaseClaim(latest, tableId));
    },
    reject(tableId) {
      return withSync((latest) => rejectClaim(latest, tableId));
    },
    accept(tableId) {
      return withSync((latest) => acceptClaim(latest, tableId));
    },
    move(fromTableId, toTableId) {
      return withSync((latest) => moveTable(latest, fromTableId, toTableId, tablesOf(latest)));
    },
    voidSend(checkId) {
      return withSync((latest) => voidLastSend(latest, checkId));
    },
  };

  return <PosContext.Provider value={api}>{children}</PosContext.Provider>;
}

export function usePos() {
  const ctx = useContext(PosContext);
  if (!ctx) throw new Error("usePos must be inside PosProvider");
  return ctx;
}
