import { useState } from "react";
import { DAYS, STAFF_ROLES, formatClock, isBoss, money, openClock, weekSheet, whoIsClocked } from "../../services/pos";
import { usePos } from "./PosProvider";

const ROLE_LABEL = { floor: "Floor", kitchen: "Kitchen", any: "Anywhere" };

export function RosterView() {
  const { state } = usePos();
  if (!isBoss(state.onStaff)) {
    return (
      <main className="till-workspace">
        <div className="till-page-head">
          <h1>This week</h1>
        </div>
        <p className="till-muted">That's for whoever opened up with the till door.</p>
      </main>
    );
  }
  return <RosterEditor />;
}

function RosterEditor() {
  const { state, venue, addPerson, dropPerson, addMeal, dropMeal, flipShift, patchPerson, flipOff } = usePos();
  const [name, setName] = useState("");
  const [pin, setPin] = useState("");
  const [role, setRole] = useState("any");
  const [rate, setRate] = useState("");
  const [meal, setMeal] = useState("");
  const [picked, setPicked] = useState(null);
  const [notice, setNotice] = useState(null);
  const [copied, setCopied] = useState(false);
  const people = venue.staff ?? [];
  const clocked = whoIsClocked(state, venue);
  const sheet = weekSheet(state, venue);
  const selectedId = picked ?? sheet[0]?.id ?? people[0]?.id ?? null;
  const person =
    (selectedId != null ? people.find((p) => String(p.id) === String(selectedId)) : null) ??
    (picked == null ? people[0] ?? null : null);
  const clockHref = `${window.location.origin}${window.location.pathname}#/clock`;
  const weekPay = sheet.reduce((sum, row) => sum + row.pay, 0);
  const weekHours = Math.round(sheet.reduce((sum, row) => sum + row.hours, 0) * 100) / 100;

  function flash(result, okText) {
    if (!result.ok) {
      setNotice(result.error);
      return;
    }
    setNotice(okText);
  }

  function onShift(staffId, day, serviceId) {
    return (state.shifts ?? []).some((s) => s.staffId === staffId && s.day === day && s.serviceId === serviceId);
  }

  return (
    <>
      <main className="till-workspace">
        <div className="till-page-head">
          <h1>This week</h1>
          <p className="till-muted">{clocked.length ? clocked.map((p) => p.name).join(", ") + " in" : "Nobody clocked in"}</p>
        </div>
        {people.length === 0 ? (
          <p className="till-empty">Add names here. Hours land here when they clock out — not a second database.</p>
        ) : (
          <table className="till-hours">
            <thead>
              <tr>
                <th>Name</th>
                <th>Hours</th>
                <th>$</th>
              </tr>
            </thead>
            <tbody>
              {sheet.map((row) => {
                const selected = selectedId != null && String(row.id) === String(selectedId);
                return (
                  <tr
                    key={row.id}
                    className={selected ? "on" : ""}
                    tabIndex={0}
                    aria-selected={selected}
                    onClick={() => setPicked(row.id)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        setPicked(row.id);
                      }
                    }}
                  >
                    <td>
                      {row.name}
                      {row.onBreak ? " · break" : row.open ? " · in" : ""}
                    </td>
                    <td>{row.hours}</td>
                    <td>{row.payRate ? money(row.pay) : "—"}</td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr>
                <th>Week</th>
                <th>{weekHours}</th>
                <th>{weekPay ? money(weekPay) : "—"}</th>
              </tr>
            </tfoot>
          </table>
        )}
        {person ? (
          <section className="till-week">
            <div className="till-page-head">
              <h2>{person.name}</h2>
              <button type="button" className="till-ghost" onClick={() => dropPerson(person.id).then((r) => flash(r, "Removed"))}>
                Remove
              </button>
            </div>
            <label className="till-name till-rate">
              $/hr
              <input
                key={person.id}
                inputMode="decimal"
                defaultValue={person.payRate || ""}
                placeholder="0"
                onBlur={(e) => {
                  const next = Math.max(0, Number(e.target.value) || 0);
                  if (next === person.payRate) return;
                  patchPerson(person.id, { payRate: next }).then((r) => flash(r, "Rate saved"));
                }}
              />
            </label>
            {(venue.services ?? []).map((service) => (
              <div key={service.id} className="till-week-row">
                <span>{service.name}</span>
                <div className="till-week-days">
                  {DAYS.map((d, day) => {
                    const on = onShift(person.id, day, service.id);
                    return (
                      <button
                        key={`${service.id}-${day}`}
                        type="button"
                        className={on ? "till-week-day on" : "till-week-day"}
                        onClick={() => flipShift(person.id, day, service.id)}
                      >
                        {d}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
            <div className="till-week-row">
              <span>Off</span>
              <div className="till-week-days">
                {DAYS.map((d, day) => {
                  const off = (person.offDays ?? []).includes(day);
                  return (
                    <button
                      key={`off-${day}`}
                      type="button"
                      className={off ? "till-week-day away" : "till-week-day"}
                      onClick={() => flipOff(person.id, day)}
                    >
                      {d}
                    </button>
                  );
                })}
              </div>
            </div>
            {openClock(state, person.id) ? (
              <p className="till-muted">In since {formatClock(openClock(state, person.id).inAt)} — hours count until they clock out.</p>
            ) : null}
          </section>
        ) : null}
        {notice ? <p className={/^(Added|Removed|Rate)/.test(notice) ? "till-ok" : "till-error"}>{notice}</p> : null}
      </main>
      <aside className="till-book-pane">
        <h2>Staff book</h2>
        <p className="till-muted">Same venue snapshot as the floor. Staff punch on the clock link — till stays a till.</p>
        <span className="till-add-table">
          <code className="till-code">{clockHref}</code>
          <button
            type="button"
            className="till-ghost till-copy"
            onClick={() => {
              navigator.clipboard.writeText(clockHref).then(
                () => setCopied(true),
                () => setCopied(false)
              );
            }}
          >
            {copied ? "Copied" : "Copy"}
          </button>
        </span>
        <div className="till-book-add">
          <label className="till-name till-book-add-wide">
            Name
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Maya" />
          </label>
          <label className="till-name">
            PIN
            <input inputMode="numeric" value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 8))} placeholder="2222" />
          </label>
          <label className="till-name">
            $/hr
            <input inputMode="decimal" value={rate} onChange={(e) => setRate(e.target.value.replace(/[^\d.]/g, ""))} placeholder="32" />
          </label>
          <label className="till-name till-book-add-wide">
            Where
            <select value={role} onChange={(e) => setRole(e.target.value)}>
              {STAFF_ROLES.map((r) => (
                <option key={r} value={r}>
                  {ROLE_LABEL[r]}
                </option>
              ))}
            </select>
          </label>
        </div>
        <button
          type="button"
          className="till-primary"
          onClick={() =>
            addPerson({ name, pin, role, payRate: Number(rate) || 0 }).then((r) => {
              flash(r, "Added");
              if (r.ok) {
                setName("");
                setPin("");
                setRate("");
              }
            })
          }
        >
          Add person
        </button>
        <div className="till-offer-add">
          <input placeholder="Arvo" value={meal} onChange={(e) => setMeal(e.target.value)} />
          <button
            type="button"
            className="till-ghost"
            onClick={() =>
              addMeal(meal).then((r) => {
                flash(r, "Added service");
                if (r.ok) setMeal("");
              })
            }
          >
            Add
          </button>
        </div>
        {(venue.services ?? []).length > 1
          ? venue.services.map((s) => (
              <button key={s.id} type="button" className="till-ghost" onClick={() => dropMeal(s.id).then((r) => flash(r, "Removed service"))}>
                Drop {s.name}
              </button>
            ))
          : null}
      </aside>
    </>
  );
}
