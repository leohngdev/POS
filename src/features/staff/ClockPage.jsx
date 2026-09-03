import { useState } from "react";
import { formatClock, openClock } from "../../services/pos";
import { usePos } from "../till/PosProvider";

export function ClockPage() {
  const { state, venue, punchIn, punchOut } = usePos();
  const [who, setWho] = useState(null);
  const [digits, setDigits] = useState("");
  const [notice, setNotice] = useState(null);
  const people = venue.staff ?? [];
  const person = people.find((p) => p.id === who) ?? null;
  const open = who ? openClock(state, who) : null;
  const off = venue.useRoster === false;

  function press(d) {
    if (d === "←") {
      setDigits((v) => v.slice(0, -1));
      return;
    }
    setDigits((v) => (v.length >= 8 ? v : v + d));
  }

  function go(action) {
    const run = action === "in" ? punchIn : punchOut;
    run(digits, who).then((result) => {
      if (!result.ok) {
        setNotice(result.error);
        return;
      }
      setNotice(action === "in" ? `In · ${formatClock(Date.now())}` : "Out");
      setDigits("");
    });
  }

  const keys = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "←"];

  if (off) {
    return (
      <div className="till-root till-gate">
        <div className="till-gate-box">
          <p className="till-eyebrow">Clock</p>
          <h1>Roster is off</h1>
          <p className="till-muted">This venue is using the till door code only.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="till-root till-gate">
      <div className="till-gate-box">
        <p className="till-eyebrow">{venue.name || "Clock"}</p>
        <h1>{person ? person.name : "Clock in"}</h1>
        {!person ? (
          <p className="till-muted">Your phone. Not the till. Tap your name.</p>
        ) : open ? (
          <p className="till-muted">In since {formatClock(open.inAt)}. PIN to clock out.</p>
        ) : (
          <p className="till-muted">Your PIN to clock in.</p>
        )}
        {!person ? (
          <div className="till-who">
            {people.length === 0 ? <p className="till-muted">No names on the book yet.</p> : null}
            {people.map((p) => (
              <button key={p.id} type="button" className="till-table" onClick={() => setWho(p.id)}>
                {p.name}
              </button>
            ))}
          </div>
        ) : (
          <>
            <button
              type="button"
              className="till-ghost guest-change"
              onClick={() => {
                setWho(null);
                setDigits("");
                setNotice(null);
              }}
            >
              Not me
            </button>
            <div className="till-pin-dots" aria-label="PIN length">
              {digits.length ? digits.replace(/./g, "•") : "enter PIN"}
            </div>
            {notice ? <p className={/^(In|Out)/.test(notice) ? "till-ok" : "till-error"}>{notice}</p> : null}
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
            {open ? (
              <button type="button" className="till-primary" onClick={() => go("out")} disabled={!digits}>
                Clock out
              </button>
            ) : (
              <button type="button" className="till-primary" onClick={() => go("in")} disabled={!digits}>
                Clock in
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
