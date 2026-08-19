import { useState } from "react";
import { usePos } from "./PosProvider";

export function PinGate() {
  const { state, unlock } = usePos();
  const [digits, setDigits] = useState("");

  function press(d) {
    if (d === "←") {
      setDigits((v) => v.slice(0, -1));
      return;
    }
    setDigits((v) => (v.length >= 8 ? v : v + d));
  }

  function submit() {
    unlock(digits);
  }

  const keys = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "←"];

  return (
    <div className="till-root till-gate">
      <div className="till-gate-box">
        <p className="till-eyebrow">Staff till</p>
        <h1>PIN</h1>
        <p className="till-muted">Unlock this till. Starter PIN is 1234.</p>
        <div className="till-pin-dots" aria-label="PIN length">
          {(digits.length ? digits.replace(/./g, "•") : "enter PIN")}
        </div>
        {state.pinError ? <p className="till-error" role="alert">{state.pinError}</p> : null}
        <div className="till-pad">
          {keys.map((k, i) =>
            k === "" ? (
              <span key={i} />
            ) : (
              <button key={k} type="button" className="till-pad-key" onClick={() => press(k)}>
                {k}
              </button>
            )
          )}
        </div>
        <button type="button" className="till-primary" onClick={submit} disabled={!digits}>
          Unlock
        </button>
      </div>
    </div>
  );
}
