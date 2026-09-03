import { useState } from "react";
import { DAYS, STAFF_ROLES, formatClock, openClock, whoIsClocked } from "../../services/pos";
import { usePos } from "./PosProvider";

const ROLE_LABEL = { floor: "Floor", kitchen: "Kitchen", any: "Anywhere" };

export function RosterView() {
  const { state, venue, addPerson, dropPerson, addMeal, dropMeal, flipShift } = usePos();
  const [name, setName] = useState("");
  const [pin, setPin] = useState("");
  const [role, setRole] = useState("any");
  const [meal, setMeal] = useState("");
  const [picked, setPicked] = useState(null);
  const [notice, setNotice] = useState(null);
  const people = venue.staff ?? [];
  const person = people.find((p) => p.id === picked) ?? people[0] ?? null;
  const clocked = whoIsClocked(state, venue);
  const clockHref = `${window.location.origin}${window.location.pathname}#/clock`;

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
          <h1>People</h1>
          <p className="till-muted">{clocked.length ? clocked.map((p) => p.name).join(", ") + " in" : "Nobody clocked in"}</p>
        </div>
        {people.length === 0 ? (
          <p className="till-empty">Add names here. Staff clock in on their phone — not this till.</p>
        ) : (
          <ul className="till-people">
            {people.map((p) => {
              const open = openClock(state, p.id);
              return (
                <li key={p.id}>
                  <button
                    type="button"
                    className={person?.id === p.id ? "till-person on" : "till-person"}
                    onClick={() => setPicked(p.id)}
                  >
                    <strong>{p.name}</strong>
                    <span>
                      {ROLE_LABEL[p.role] || "Anywhere"}
                      {open ? ` · in ${formatClock(open.inAt)}` : ""}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
        {person ? (
          <section className="till-week">
            <div className="till-page-head">
              <h2>{person.name}</h2>
              <button type="button" className="till-ghost" onClick={() => dropPerson(person.id).then((r) => flash(r, "Removed"))}>
                Remove
              </button>
            </div>
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
          </section>
        ) : null}
        {notice ? <p className={/^(Added|Removed)/.test(notice) ? "till-ok" : "till-error"}>{notice}</p> : null}
      </main>
      <aside className="till-book-pane">
        <h2>Staff book</h2>
        <p className="till-muted">Saved on this venue — same snapshot as the floor. Staff use the clock link, not the till PIN pad.</p>
        <code className="till-code">{clockHref}</code>
        <div className="till-book-add">
          <label className="till-name till-book-add-wide">
            Name
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Maya" />
          </label>
          <label className="till-name">
            PIN
            <input inputMode="numeric" value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 8))} placeholder="2222" />
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
            addPerson({ name, pin, role }).then((r) => {
              flash(r, "Added");
              if (r.ok) {
                setName("");
                setPin("");
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
