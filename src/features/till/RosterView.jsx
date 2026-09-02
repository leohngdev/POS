import { useState } from "react";
import { DAYS, rosterOn, STAFF_ROLES } from "../../services/pos";
import { usePos } from "./PosProvider";

const ROLE_LABEL = { floor: "Floor", kitchen: "Kitchen", any: "Anywhere" };

export function RosterView() {
  const { state, venue, addPerson, dropPerson, addMeal, dropMeal, flipShift } = usePos();
  const [name, setName] = useState("");
  const [pin, setPin] = useState("");
  const [role, setRole] = useState("any");
  const [meal, setMeal] = useState("");
  const [notice, setNotice] = useState(null);
  const today = new Date().getDay();
  const onNow = state.onStaff;

  function flash(result, okText) {
    if (!result.ok) {
      setNotice(result.error);
      return;
    }
    setNotice(okText);
  }

  return (
    <>
      <main className="till-workspace">
        <h1>Roster</h1>
        <p className="till-muted">
          {onNow && onNow.id !== "till" ? `${onNow.name} is on the till.` : "Nobody named is on."} Tap a cell to put someone on Lunch or Dinner. Turn this off in Settings if you do not roster.
        </p>
        <div className="till-roster">
          <div className="till-roster-head">
            <span />
            {DAYS.map((d, i) => (
              <strong key={d} className={i === today ? "on" : ""}>
                {d}
              </strong>
            ))}
          </div>
          {(venue.services ?? []).map((service) => (
            <div key={service.id} className="till-roster-row">
              <span>{service.name}</span>
              {DAYS.map((d, day) => {
                const on = rosterOn(state, day, service.id);
                return (
                  <div key={`${service.id}-${day}`} className={`till-roster-cell${day === today ? " today" : ""}`}>
                    {on.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        className="till-roster-chip"
                        onClick={() => flipShift(p.id, day, service.id)}
                      >
                        {p.name}
                      </button>
                    ))}
                    <select
                      aria-label={`Add ${service.name} ${d}`}
                      defaultValue=""
                      onChange={(e) => {
                        const id = e.target.value;
                        if (!id) return;
                        flipShift(id, day, service.id);
                        e.target.value = "";
                      }}
                    >
                      <option value="">+</option>
                      {(venue.staff ?? [])
                        .filter((p) => !on.some((x) => x.id === p.id))
                        .map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name}
                          </option>
                        ))}
                    </select>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
        <div className="till-offer-add">
          <input placeholder="Arvo" value={meal} onChange={(e) => setMeal(e.target.value)} />
          <button type="button" className="till-ghost" onClick={() => addMeal(meal).then((r) => { flash(r, "Added service"); if (r.ok) setMeal(""); })}>
            Add service
          </button>
          {(venue.services ?? []).length > 1
            ? venue.services.map((s) => (
                <button key={s.id} type="button" className="till-ghost" onClick={() => dropMeal(s.id).then((r) => flash(r, "Removed service"))}>
                  Remove {s.name}
                </button>
              ))
            : null}
        </div>
        {notice ? <p className={/^(Added|Removed)/.test(notice) ? "till-ok" : "till-error"}>{notice}</p> : null}
      </main>
      <aside className="till-book-pane">
        <h2>People</h2>
        {(venue.staff ?? []).length === 0 ? <p className="till-muted">No names yet. The till door PIN still opens the pad.</p> : null}
        <ul className="till-diary">
          {(venue.staff ?? []).map((p) => (
            <li key={p.id} className="till-diary-card">
              <div>
                <strong>{p.name}</strong>
                <span>
                  {ROLE_LABEL[p.role] || "Anywhere"} · PIN {p.pin}
                </span>
              </div>
              <button type="button" className="till-ghost" onClick={() => dropPerson(p.id).then((r) => flash(r, "Removed"))}>
                Remove
              </button>
            </li>
          ))}
        </ul>
        <label className="till-name">
          Name
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Maya" />
        </label>
        <label className="till-name">
          Their PIN
          <input inputMode="numeric" value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 8))} placeholder="4–8 digits" />
        </label>
        <label className="till-name">
          Where
          <select value={role} onChange={(e) => setRole(e.target.value)}>
            {STAFF_ROLES.map((r) => (
              <option key={r} value={r}>
                {ROLE_LABEL[r]}
              </option>
            ))}
          </select>
        </label>
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
      </aside>
    </>
  );
}
