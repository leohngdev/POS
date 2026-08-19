import { createContext, useContext, useReducer } from "react";
import {
  createInitialState,
  send,
  payCheck,
  bumpChit,
  undoLastBump,
} from "../../services/pos";
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

export function PosProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, null, createInitialState);

  const api = {
    state,
    venue: VENUE,
    unlock(pin) {
      if (pin === VENUE.pin) dispatch({ type: "unlock-ok" });
      else dispatch({ type: "unlock-fail" });
    },
    sendOrder(payload) {
      const result = send({ state, venue: VENUE, now: Date.now(), ...payload });
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
  };

  return <PosContext.Provider value={api}>{children}</PosContext.Provider>;
}

export function usePos() {
  const ctx = useContext(PosContext);
  if (!ctx) throw new Error("usePos must be inside PosProvider");
  return ctx;
}
