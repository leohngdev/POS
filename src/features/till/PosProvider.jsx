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
} from "../../services/pos";
import { loadState, writeStore, STORAGE_KEY, toSnapshot } from "../../services/persist";
import { VENUE } from "../../services/venue";
import { applyOnVenue, hasLocalService, POLL_MS, pullSnapshot, pushSnapshot, sessionize } from "../../services/sync";

const PosContext = createContext(null);

function reducer(state, action) {
  switch (action.type) {
    case "unlock-fail":
      return { ...state, pinError: "Wrong PIN" };
    case "replace":
      return action.state;
    case "hydrate-remote":
      return { ...action.state, unlocked: state.unlocked, pinError: state.pinError };
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
  return { ...loaded, unlocked: session.unlocked, pinError: session.pinError };
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

  const venue = useMemo(() => ({ ...VENUE, ...state.venue }), [state.venue]);

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
    unlock(pin) {
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
          const livePin = base.venue?.pin ?? VENUE.pin;
          if (pin !== livePin) {
            dispatch({ type: "unlock-fail" });
            return;
          }
          dispatch({ type: "replace", state: { ...base, unlocked: true, pinError: null } });
        })
        .finally(() => {
          mutatingRef.current = false;
        });
    },
    lock() {
      dispatch({ type: "replace", state: { ...fromStore(state), unlocked: false, pinError: null } });
    },
    sendOrder(payload) {
      return withSync((latest) => send({ state: latest, venue: { ...VENUE, ...latest.venue }, now: Date.now(), ...payload }));
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
    addDish(item) {
      return withSync((latest) => addMenuItem(latest, item));
    },
    patchDish(itemId, patch) {
      return withSync((latest) => patchMenuItem(latest, itemId, patch));
    },
    setCovers(checkId, covers) {
      return withSync((latest) => setCheckCovers(latest, checkId, covers));
    },
    setDiscount(checkId, rate) {
      return withSync((latest) => setCheckDiscount(latest, checkId, rate));
    },
    closeNight() {
      return withSync((latest) => endNight(latest));
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
