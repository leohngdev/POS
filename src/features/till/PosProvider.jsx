import { createContext, useContext, useEffect, useMemo, useReducer } from "react";
import {
  createInitialState,
  send,
  payCheck,
  bumpChit,
  undoLastBump,
  updateVenueTaxes,
} from "../../services/pos";
import { loadState, writeStore } from "../../services/persist";
import { VENUE } from "../../services/venue";

const PosContext = createContext(null);

function reducer(state, action) {
  switch (action.type) {
    case "unlock-ok":
      return { ...state, unlocked: true, pinError: null };
    case "unlock-fail":
      return { ...state, pinError: "Wrong PIN" };
    case "replace":
      return action.state;
    default:
      return state;
  }
}

function boot() {
  if (typeof localStorage === "undefined") return createInitialState();
  return loadState(createInitialState(), localStorage);
}

export function PosProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, null, boot);

  useEffect(() => {
    if (typeof localStorage === "undefined") return;
    writeStore(state, localStorage);
  }, [state]);

  const venue = useMemo(() => ({ ...VENUE, ...state.venue }), [state.venue]);

  const api = {
    state,
    venue,
    unlock(pin) {
      if (pin === VENUE.pin) dispatch({ type: "unlock-ok" });
      else dispatch({ type: "unlock-fail" });
    },
    lock() {
      dispatch({ type: "replace", state: { ...state, unlocked: false, pinError: null } });
    },
    sendOrder(payload) {
      const result = send({ state, venue, now: Date.now(), ...payload });
      if (result.ok) dispatch({ type: "replace", state: result.state });
      return result;
    },
    pay(checkId, paidVia) {
      const result = payCheck(state, checkId, paidVia);
      if (result.ok) dispatch({ type: "replace", state: result.state });
      return result;
    },
    bump(chitId) {
      const result = bumpChit(state, chitId, Date.now());
      if (result.ok) dispatch({ type: "replace", state: result.state });
      return result;
    },
    undoBump() {
      const result = undoLastBump(state);
      if (result.ok) dispatch({ type: "replace", state: result.state });
      return result;
    },
    setVenueTaxes(patch) {
      dispatch({ type: "replace", state: updateVenueTaxes(state, patch) });
    },
  };

  return <PosContext.Provider value={api}>{children}</PosContext.Provider>;
}

export function usePos() {
  const ctx = useContext(PosContext);
  if (!ctx) throw new Error("usePos must be inside PosProvider");
  return ctx;
}
