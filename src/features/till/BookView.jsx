import { useMemo, useState } from "react";
import {
  daySlots,
  defaultBookSlot,
  formatClock,
  liveZones,
  startOfLocalDay,
  tableRecords,
  tablesInZone,
  tonightBookings,
} from "../../services/pos";
import { usePos } from "./PosProvider";
import { FloorMap } from "./FloorMap";

function ZoneChips({ zones, zoneId, onPick }) {
  if (zones.length < 2) return null;
  return (
    <div className="till-strip">
      <button type="button" className={zoneId === "all" ? "till-table till-table-sm on" : "till-table till-table-sm"} onClick={() => onPick("all")}>
        All
      </button>
      {zones.map((z) => (
        <button
          key={z.id}
          type="button"
          className={zoneId === z.id ? "till-table till-table-sm on" : "till-table till-table-sm"}
          onClick={() => onPick(z.id)}
        >
          {z.name}
        </button>
      ))}
    </div>
  );
}

export function BookView() {
  const { state, venue, book, holdTable, seat, cancelBook, noShow } = usePos();
  const [dayOffset, setDayOffset] = useState(0);
  const [slot, setSlot] = useState(() => defaultBookSlot(Date.now()));
  const [zoneId, setZoneId] = useState("all");
  const [tableId, setTableId] = useState(null);
  const [name, setName] = useState("");
  const [covers, setCovers] = useState("2");
  const [phone, setPhone] = useState("");
  const [notice, setNotice] = useState(null);
  const zones = liveZones(venue);
  const records = tablesInZone(venue, zoneId);
  const allTables = tableRecords(venue);
  const day = startOfLocalDay(Date.now()) + dayOffset * 24 * 60 * 60 * 1000;
  const slots = useMemo(() => daySlots(day), [day]);
  const previewAt = slots.includes(slot) ? slot : slots[0] ?? day;
  const diary = tonightBookings(state.bookings, day);

  function flash(result, okText) {
    if (!result.ok) {
      setNotice(result.error);
      return false;
    }
    setNotice(okText);
    return true;
  }

  function pickSlot(at) {
    setSlot(at);
    setNotice(null);
  }

  function pickTable(id) {
    setTableId((cur) => (cur === id ? null : id));
    setNotice(null);
  }

  function add() {
    book({
      name,
      covers: Number(covers),
      phone,
      tableId,
      at: previewAt,
    }).then((result) => {
      if (!flash(result, `Booked ${name.trim() || ""}`.trim())) return;
      setName("");
      setPhone("");
    });
  }

  return (
    <>
      <main className="till-workspace">
        <h1>Book</h1>
        <p className="till-muted">Tonight’s names on this floor. Walk-ins still use Dine in. Hold is {venue.bookingMins} minutes.</p>
        <div className="till-strip">
          <button type="button" className={dayOffset === 0 ? "till-table till-table-sm on" : "till-table till-table-sm"} onClick={() => setDayOffset(0)}>
            Today
          </button>
          <button type="button" className={dayOffset === 1 ? "till-table till-table-sm on" : "till-table till-table-sm"} onClick={() => setDayOffset(1)}>
            Tomorrow
          </button>
        </div>
        <ZoneChips zones={zones} zoneId={zoneId} onPick={setZoneId} />
        <div className="till-slots" role="listbox" aria-label="Time">
          {slots.map((at) => (
            <button
              key={at}
              type="button"
              className={previewAt === at ? "till-slot on" : "till-slot"}
              onClick={() => pickSlot(at)}
            >
              {formatClock(at)}
            </button>
          ))}
        </div>
        <FloorMap tables={records} state={state} selectedId={tableId} onSelect={pickTable} at={previewAt} preview />
      </main>
      <aside className="till-book-pane">
        <h2>Who’s coming?</h2>
        <label className="till-name">
          Name
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Sam" />
        </label>
        <label className="till-name">
          Guests
          <input type="number" min="1" max="99" value={covers} onChange={(e) => setCovers(e.target.value)} />
        </label>
        <label className="till-name">
          Phone
          <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Optional" />
        </label>
        <p className="till-muted">
          {formatClock(previewAt)}
          {tableId ? ` · Table ${tableId}` : " · no table yet (waitlist)"}
        </p>
        <button type="button" className="till-primary" onClick={add}>
          Add to the book
        </button>
        {notice ? (
          <p className={/^(Booked|Seated|Held|Marked|Cancelled)/.test(notice) ? "till-ok" : "till-error"}>{notice}</p>
        ) : null}
        <ul className="till-diary">
          {diary.length === 0 ? <li className="till-muted">No names yet. Walk-ins use the floor.</li> : null}
          {diary.map((b) => (
            <li key={b.id} className={`till-diary-card ${b.status}`}>
              <div>
                <strong>
                  {formatClock(b.at)} · {b.name}
                </strong>
                <span>
                  {b.covers} guests{b.tableId ? ` · Table ${b.tableId}` : " · no table"}
                  {b.phone ? ` · ${b.phone}` : ""}
                </span>
                {b.status !== "booked" ? <em>{b.status === "no-show" ? "No show" : b.status}</em> : null}
              </div>
              {b.status === "booked" ? (
                <div className="till-diary-actions">
                  {b.tableId ? (
                    <button type="button" className="till-ghost" onClick={() => seat(b.id).then((r) => flash(r, `Seated ${b.name}`))}>
                      Seat
                    </button>
                  ) : (
                    <select
                      aria-label={`Hold a table for ${b.name}`}
                      defaultValue=""
                      onChange={(e) => {
                        const id = e.target.value;
                        if (!id) return;
                        holdTable(b.id, id).then((r) => flash(r, r.ok ? `Held ${id}` : r.error));
                        e.target.value = "";
                      }}
                    >
                      <option value="">Hold table…</option>
                      {allTables.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.id}
                        </option>
                      ))}
                    </select>
                  )}
                  <button type="button" className="till-ghost" onClick={() => noShow(b.id).then((r) => flash(r, "Marked no show"))}>
                    No show
                  </button>
                  <button type="button" className="till-ghost" onClick={() => cancelBook(b.id).then((r) => flash(r, "Cancelled"))}>
                    Cancel
                  </button>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      </aside>
    </>
  );
}
