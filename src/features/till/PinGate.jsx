import { useState } from "react";
import { usePos } from "./PosProvider";

export function PinGate() {
  const { state, venue, unlock } = usePos();
  const [digits, setDigits] = useState("");
  const [who, setWho] = useState(null);
  const people = venue.staff ?? [];
  const named = people.length > 0;

  function press(d) {
    if (d === "←") {
      setDigits((v) => v.slice(0, -1));
      return;
    }
    setDigits((v) => (v.length >= 8 ? v : v + d));
  }

  function submit() {
    unlock(digits, who);
  }

  const keys = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "←"];

  return (
    <div className="till-root till-gate">
      <div className="till-gate-box">
        <p className="till-eyebrow">{who === "till" ? "Opening up" : "Staff till"}</p>
        <h1>{named && !who ? "Who’s on?" : "PIN"}</h1>
        {named && !who ? (
          <p className="till-muted">Tap your name. Till door is for opening up — Settings and Roster live there.</p>
        ) : (
          <p className="till-muted">{who && who !== "till" ? `Hi ${people.find((p) => p.id === who)?.name ?? ""}. Your PIN.` : "Unlock this till. Change the PIN in Settings."}</p>
        )}
        {named && !who ? (
          <div className="till-who">
            {people.map((p) => (
              <button key={p.id} type="button" className="till-table" onClick={() => setWho(p.id)}>
                {p.name}
              </button>
            ))}
            <button type="button" className="till-ghost" onClick={() => setWho("till")}>
              Till door
            </button>
          </div>
        ) : (
          <>
            {named ? (
              <button type="button" className="till-ghost guest-change" onClick={() => { setWho(null); setDigits(""); }}>
                Not me
              </button>
            ) : null}
            <div className="till-pin-dots" aria-label="PIN length">
              {digits.length ? digits.replace(/./g, "•") : "enter PIN"}
            </div>
            {state.pinError ? (
              <p className="till-error" role="alert">
                {state.pinError}
              </p>
            ) : null}
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
          </>
        )}
      </div>
    </div>
  );
}
