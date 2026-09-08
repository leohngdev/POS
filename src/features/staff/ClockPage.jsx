import { useEffect, useState } from "react";
import {
  DAYS,
  clockHome,
  formatClock,
  formatDuration,
  formatLiveClock,
  money,
  weekSheet,
} from "../../services/pos";
import { usePos } from "../till/PosProvider";

const WHO_KEY = "pos-clock-who";
const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "←"];

function loadWho() {
  try {
    return sessionStorage.getItem(WHO_KEY);
  } catch {
    return null;
  }
}

function saveWho(id) {
  try {
    if (id) sessionStorage.setItem(WHO_KEY, id);
    else sessionStorage.removeItem(WHO_KEY);
  } catch {
    /* private mode */
  }
}

function useNow(ms = 1000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(id);
  }, [ms]);
  return now;
}

function dayLine(at) {
  const d = new Date(at);
  return `${DAYS[d.getDay()]} ${d.getDate()} ${d.toLocaleString("en-AU", { month: "short" })}`;
}

function LiveTime({ now }) {
  return (
    <header className="clock-hero">
      <p className="till-eyebrow">Clock</p>
      <p className="clock-live">{formatLiveClock(now)}</p>
      <p className="clock-date">{dayLine(now)}</p>
    </header>
  );
}

export function ClockPage() {
  const { state, venue, punchIn, punchOut, punchBreak, flipOwnOff } = usePos();
  const now = useNow();
  const [who, setWho] = useState(loadWho);
  const [digits, setDigits] = useState("");
  const [pending, setPending] = useState(null);
  const [notice, setNotice] = useState(null);
  const people = venue.staff ?? [];
  const person = people.find((p) => p.id === who) ?? null;
  const home = person ? clockHome(state, venue, person.id, now) : null;
  const sheet = weekSheet(state, venue, now);
  const off = venue.useRoster === false;
  const today = new Date(now).getDay();

  useEffect(() => {
    if (who && !people.some((p) => p.id === who)) {
      setWho(null);
      saveWho(null);
    }
  }, [who, people]);

  function pick(id) {
    setWho(id);
    saveWho(id);
    setDigits("");
    setPending(null);
    setNotice(null);
  }

  function notMe() {
    setWho(null);
    saveWho(null);
    setDigits("");
    setPending(null);
    setNotice(null);
  }

  function press(d) {
    if (d === "←") {
      setDigits((v) => v.slice(0, -1));
      return;
    }
    setDigits((v) => (v.length >= 8 ? v : v + d));
  }

  function ask(action) {
    setPending(action);
    setDigits("");
    setNotice(null);
  }

  function go() {
    if (!pending || !person) return;
    const run = pending === "in" ? punchIn : pending === "out" ? punchOut : punchBreak;
    run(digits, person.id).then((result) => {
      if (!result.ok) {
        setNotice(result.error);
        return;
      }
      const label =
        pending === "in"
          ? `In · ${formatClock(Date.now())}`
          : pending === "out"
            ? "Out"
            : home?.onBreak
              ? "Break over"
              : "On break";
      setNotice(label);
      setDigits("");
      setPending(null);
    });
  }

  if (off) {
    return (
      <div className="till-root clock-root">
        <p className="till-eyebrow">Clock</p>
        <h1>Roster is off</h1>
        <p className="till-muted">This venue is using the till door code only.</p>
      </div>
    );
  }

  if (!person) {
    return (
      <div className="till-root clock-root">
        <LiveTime now={now} />
        <h1>Who’s this?</h1>
        <p className="till-muted">Your phone or the clock tablet. Tap your name — PIN comes later, when you punch.</p>
        {notice ? <p className="till-error">{notice}</p> : null}
        <div className="clock-who-list">
          {people.length === 0 ? <p className="till-muted">No names on the book yet.</p> : null}
          {people.map((p) => {
            const row = sheet.find((r) => r.id === p.id);
            const status = row?.onBreak ? "On break" : row?.open ? "In" : "Out";
            return (
              <button key={p.id} type="button" className={row?.open ? "clock-who on" : "clock-who"} onClick={() => pick(p.id)}>
                <strong>{p.name}</strong>
                <span>{status}</span>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  const statusCopy = home?.onBreak
    ? `On break since ${formatClock(home.breakAt)} · ${formatDuration(home.shiftMs)} this shift`
    : home?.open
      ? `In since ${formatClock(home.inAt)} · ${formatDuration(home.shiftMs)} this shift`
      : "You're out. Clock in when you're here.";
  const statusKind = home?.onBreak ? "break" : home?.open ? "in" : "out";
  const confirmLabel =
    pending === "in" ? "Clock in" : pending === "out" ? "Clock out" : home?.onBreak ? "End break" : "Start break";
  const pinHint =
    pending === "in"
      ? "Your PIN to clock in."
      : pending === "out"
        ? "Your PIN to clock out."
        : home?.onBreak
          ? "Your PIN to end break."
          : "Your PIN to start break.";

  return (
    <div className="till-root clock-root">
      <LiveTime now={now} />
      <div className="clock-me">
        <h1>{person.name}</h1>
        <button type="button" className="till-ghost guest-change" onClick={notMe}>
          Not me
        </button>
      </div>
      <p className={`clock-status ${statusKind}`}>{statusCopy}</p>
      <div className={home?.payRate ? "clock-stats" : "clock-stats one"}>
        <div className="clock-stat">
          <span>This week</span>
          <b>{home?.hours ?? 0}h</b>
        </div>
        {home?.payRate ? (
          <div className="clock-stat">
            <span>Pay</span>
            <b>{money(home.pay)}</b>
          </div>
        ) : null}
      </div>
      <section className="clock-off">
        <h2>Days off</h2>
        <p className="till-muted">Tap a day you can’t work. Same book as the till.</p>
        <div className="till-week-days">
          {DAYS.map((d, day) => {
            const away = (home?.offDays ?? []).includes(day);
            return (
              <button
                key={d}
                type="button"
                className={`till-week-day${away ? " away" : ""}${day === today ? " clock-today" : ""}`}
                onClick={() =>
                  flipOwnOff(person.id, day).then((result) => {
                    if (!result.ok) setNotice(result.error);
                  })
                }
              >
                {d}
              </button>
            );
          })}
        </div>
      </section>
      {notice ? <p className={/^(In|Out|On break|Break)/.test(notice) ? "till-ok" : "till-error"}>{notice}</p> : null}
      {pending ? (
        <section className="clock-confirm">
          <p className="till-muted">{pinHint}</p>
          <div className="till-pin-dots" aria-label="PIN length">
            {digits.length ? digits.replace(/./g, "•") : "enter PIN"}
          </div>
          <div className="till-pad">
            {KEYS.map((k, i) =>
              k === "" ? (
                <span key={i} />
              ) : (
                <button key={k} type="button" className="till-pad-key" onClick={() => press(k)}>
                  {k}
                </button>
              )
            )}
          </div>
          <div className="till-clock-actions">
            <button
              type="button"
              className="till-ghost"
              onClick={() => {
                setPending(null);
                setDigits("");
                setNotice(null);
              }}
            >
              Cancel
            </button>
            <button type="button" className="till-primary" onClick={go} disabled={!digits}>
              {confirmLabel}
            </button>
          </div>
        </section>
      ) : home?.open ? (
        <div className="till-clock-actions">
          <button type="button" className="till-ghost" onClick={() => ask("break")}>
            {home.onBreak ? "End break" : "Start break"}
          </button>
          <button type="button" className="till-primary" onClick={() => ask("out")}>
            Clock out
          </button>
        </div>
      ) : (
        <button type="button" className="till-primary" onClick={() => ask("in")}>
          Clock in
        </button>
      )}
    </div>
  );
}
