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
  clockIn,
  clockOut,
  punchIn as punchClockIn,
  punchOut as punchClockOut,
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
      return withSync((latest) => ({ ok: true, error: null, state: updateVenueTaxes(latest, patch) }));
    },
    renameVenue(name) {
      return withSync((latest) => setVenueName(latest, name));
    },
    changePin(pin) {
      return withSync((latest) => setPin(latest, pin));
    },
    changeTableCount(count) {
      return withSync((latest) => setTableCount(latest, count));
    },
    addFloorTable(id, zoneId, afterId) {
      return withSync((latest) => addTable(latest, id, zoneId, afterId));
    },
    removeFloorTable(id) {
      return withSync((latest) => removeTable(latest, id));
    },
    moveFloorTable(id, patch) {
      return withSync((latest) => patchTable(latest, id, patch));
    },
    renameFloorTable(id, next) {
      return withSync((latest) => renameTable(latest, id, next));
    },
    reorderFloorTable(id, toIndex) {
      return withSync((latest) => reorderTable(latest, id, toIndex));
    },
    addFloorZone(name) {
      return withSync((latest) => addZone(latest, name));
    },
    renameFloorZone(id, name) {
      return withSync((latest) => renameZone(latest, id, name));
    },
    removeFloorZone(id) {
      return withSync((latest) => removeZone(latest, id));
    },
    addDish(item) {
      return withSync((latest) => addMenuItem(latest, item));
    },
    patchDish(itemId, patch) {
      return withSync((latest) => patchMenuItem(latest, itemId, patch));
    },
    addVenueOffer(draft) {
      return withSync((latest) => addOffer(latest, draft));
    },
    removeVenueOffer(id) {
      return withSync((latest) => removeOffer(latest, id));
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
      return withSync((latest) => endNight(latest));
    },
    book(draft) {
      return withSync((latest) => addBooking(latest, draft));
    },
    holdTable(bookingId, tableId) {
      return withSync((latest) => patchBooking(latest, bookingId, { tableId }));
    },
    seat(bookingId) {
      return withSync((latest) => seatBooking(latest, bookingId, Date.now()));
    },
    cancelBook(bookingId) {
      return withSync((latest) => cancelBooking(latest, bookingId));
    },
    noShow(bookingId) {
      return withSync((latest) => markNoShow(latest, bookingId));
    },
    addStockLine(draft) {
      return withSync((latest) => addStockItem(latest, draft));
    },
    patchStockLine(id, patch) {
      return withSync((latest) => patchStockItem(latest, id, patch));
    },
    dropStockLine(id) {
      return withSync((latest) => removeStockItem(latest, id));
    },
    countStock(id, qty) {
      return withSync((latest) => setStockCount(latest, id, qty, Date.now()));
    },
    receiveLine(id, qty) {
      return withSync((latest) => receiveStock(latest, id, qty, Date.now()));
    },
    orderStock() {
      return withSync((latest) => placeStockOrder(latest, Date.now()));
    },
    takeOrderLine(orderId, itemId) {
      return withSync((latest) => receiveOrderLine(latest, orderId, itemId, undefined, Date.now()));
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
    addPerson(draft) {
      return withSync((latest) => addStaff(latest, draft));
    },
    dropPerson(id) {
      return withSync((latest) => removeStaff(latest, id));
    },
    addMeal(name) {
      return withSync((latest) => addService(latest, name));
    },
    dropMeal(id) {
      return withSync((latest) => removeService(latest, id));
    },
    flipShift(staffId, day, serviceId) {
      return withSync((latest) => toggleShift(latest, staffId, day, serviceId));
    },
    addShelf(name) {
      return withSync((latest) => addStockGroup(latest, name));
    },
    dropShelf(id) {
      return withSync((latest) => removeStockGroup(latest, id));
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
