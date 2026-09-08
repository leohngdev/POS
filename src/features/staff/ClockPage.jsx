import { useState } from "react";
import { formatClock, openBreak, openClock } from "../../services/pos";
import { usePos } from "../till/PosProvider";

export function ClockPage() {
  const { state, venue, punchIn, punchOut, punchBreak } = usePos();
  const [who, setWho] = useState(null);
  const [digits, setDigits] = useState("");
  const [notice, setNotice] = useState(null);
  const people = venue.staff ?? [];
  const person = people.find((p) => p.id === who) ?? null;
  const open = who ? openClock(state, who) : null;
  const pausing = open ? openBreak(open) : null;
  const off = venue.useRoster === false;

  function press(d) {
    if (d === "←") {
      setDigits((v) => v.slice(0, -1));
      return;
    }
    setDigits((v) => (v.length >= 8 ? v : v + d));
  }

  function go(action) {
    const run = action === "in" ? punchIn : action === "out" ? punchOut : punchBreak;
    run(digits, who).then((result) => {
      if (!result.ok) {
        setNotice(result.error);
        return;
      }
      const label = action === "in" ? `In · ${formatClock(Date.now())}` : action === "out" ? "Out" : pausing ? "Break over" : "On break";
      setNotice(label);
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

  let status = "Your PIN to clock in.";
  if (!person) status = "Your phone or the clock tablet. Tap your name.";
  else if (pausing) status = `On break since ${formatClock(pausing.inAt)}. PIN to come back or clock out.`;
  else if (open) status = `In since ${formatClock(open.inAt)}. Break or clock out.`;

  return (
    <div className="till-root till-gate">
      <div className="till-gate-box">
        <p className="till-eyebrow">{venue.name || "Clock"}</p>
        <h1>{person ? person.name : "Clock in"}</h1>
        <p className="till-muted">{status}</p>
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
            {notice ? <p className={/^(In|Out|On break|Break)/.test(notice) ? "till-ok" : "till-error"}>{notice}</p> : null}
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
              <div className="till-clock-actions">
                <button type="button" className="till-ghost" onClick={() => go("break")} disabled={!digits}>
                  {pausing ? "End break" : "Start break"}
                </button>
                <button type="button" className="till-primary" onClick={() => go("out")} disabled={!digits}>
                  Clock out
                </button>
              </div>
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
