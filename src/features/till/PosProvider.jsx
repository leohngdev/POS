import { createContext, useContext, useEffect, useMemo, useReducer } from "react";
import {
  createInitialState,
  send,
  payCheck,
  bumpChit,
  undoLastBump,
  updateVenueTaxes,
  claimTable,
  rejectClaim,
  releaseClaim,
} from "../../services/pos";
import { loadState, writeStore, STORAGE_KEY } from "../../services/persist";
import { VENUE } from "../../services/venue";

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

export function PosProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, null, boot);

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

  const venue = useMemo(() => ({ ...VENUE, ...state.venue }), [state.venue]);

  function commit(result, latest) {
    dispatch({ type: "replace", state: result.ok ? result.state : latest });
    return result;
  }

  const api = {
    state,
    venue,
    unlock(pin) {
      if (pin !== VENUE.pin) {
        dispatch({ type: "unlock-fail" });
        return;
      }
      dispatch({ type: "replace", state: { ...fromStore(state), unlocked: true, pinError: null } });
    },
    lock() {
      dispatch({ type: "replace", state: { ...fromStore(state), unlocked: false, pinError: null } });
    },
    sendOrder(payload) {
      const latest = fromStore(state);
      const venueNow = { ...VENUE, ...latest.venue };
      return commit(send({ state: latest, venue: venueNow, now: Date.now(), ...payload }), latest);
    },
    pay(checkId, paidVia) {
      const latest = fromStore(state);
      return commit(payCheck(latest, checkId, paidVia), latest);
    },
    bump(chitId) {
      const latest = fromStore(state);
      return commit(bumpChit(latest, chitId, Date.now()), latest);
    },
    undoBump() {
      const latest = fromStore(state);
      return commit(undoLastBump(latest), latest);
    },
    setVenueTaxes(patch) {
      dispatch({ type: "replace", state: updateVenueTaxes(fromStore(state), patch) });
    },
    claim(tableId) {
      const latest = fromStore(state);
      return commit(claimTable(latest, tableId, VENUE.tables, Date.now()), latest);
    },
    release(tableId) {
      const latest = fromStore(state);
      return commit(releaseClaim(latest, tableId), latest);
    },
    reject(tableId) {
      const latest = fromStore(state);
      return commit(rejectClaim(latest, tableId), latest);
    },
  };

  return <PosContext.Provider value={api}>{children}</PosContext.Provider>;
}

export function usePos() {
  const ctx = useContext(PosContext);
  if (!ctx) throw new Error("usePos must be inside PosProvider");
  return ctx;
}
