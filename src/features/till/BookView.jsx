import { useMemo, useState } from "react";
import {
  formatClock,
  formatDay,
  fromDateAndTime,
  liveZones,
  monthGrid,
  partyOnTable,
  shiftMonth,
  startOfLocalDay,
  tableRecords,
  tablesInZone,
  timeValue,
  tonightBookings,
} from "../../services/pos";
import { usePos } from "./PosProvider";
import { FloorMap } from "./FloorMap";
import { PartyCard } from "./PartyCard";

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
  const [at, setAt] = useState(() => Date.now());
  const [time, setTime] = useState(() => timeValue(Date.now()));
  const [zoneId, setZoneId] = useState("all");
  const [tableId, setTableId] = useState(null);
  const [name, setName] = useState("");
  const [covers, setCovers] = useState("2");
  const [phone, setPhone] = useState("");
  const [notice, setNotice] = useState(null);
  const [pickedId, setPickedId] = useState(null);
  const zones = liveZones(venue);
  const records = tablesInZone(venue, zoneId);
  const allTables = tableRecords(venue);
  const previewAt = fromDateAndTime(
    `${new Date(at).getFullYear()}-${String(new Date(at).getMonth() + 1).padStart(2, "0")}-${String(new Date(at).getDate()).padStart(2, "0")}`,
    time
  ) ?? at;
  const grid = useMemo(() => monthGrid(at), [at]);
  const diary = tonightBookings(state.bookings, previewAt);
  const selectedParty =
    (pickedId && (state.bookings ?? []).find((b) => b.id === pickedId)) || partyOnTable(state, tableId, previewAt);

  function flash(result, okText) {
    if (!result.ok) {
      setNotice(result.error);
      return false;
    }
    setNotice(okText);
    return true;
  }

  function pickDay(dayAt) {
    setAt(dayAt);
    setNotice(null);
  }

  function pickTable(id) {
    setTableId(id);
    const party = partyOnTable(state, id, previewAt);
    setPickedId(party?.id ?? null);
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
      if (result.state.bookings?.length) {
        setPickedId(result.state.bookings[result.state.bookings.length - 1].id);
      }
    });
  }

  return (
    <>
      <main className="till-workspace till-book">
        <div className="till-book-head">
          <h1>Book</h1>
          <p className="till-muted">
            {formatDay(previewAt)} · {formatClock(previewAt)} · hold {venue.bookingMins}m
          </p>
        </div>
        <div className="till-book-stage">
          <div className="till-cal">
            <div className="till-cal-head">
              <button type="button" className="till-ghost" onClick={() => setAt(shiftMonth(at, -1))} aria-label="Previous month">
                ‹
              </button>
              <strong>{grid.label}</strong>
              <button type="button" className="till-ghost" onClick={() => setAt(shiftMonth(at, 1))} aria-label="Next month">
                ›
              </button>
            </div>
            <div className="till-cal-dow">
              {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
                <span key={`${d}-${i}`}>{d}</span>
              ))}
            </div>
            <div className="till-cal-grid">
              {grid.cells.map((day, i) =>
                day ? (
                  <button
                    key={day}
                    type="button"
                    className={startOfLocalDay(day) === startOfLocalDay(previewAt) ? "till-cal-day on" : "till-cal-day"}
                    onClick={() => pickDay(day)}
                  >
                    {new Date(day).getDate()}
                  </button>
                ) : (
                  <span key={`e-${i}`} />
                )
              )}
            </div>
            <label className="till-name till-cal-time">
              Time
              <input type="time" step="900" value={time} onChange={(e) => setTime(e.target.value || "18:00")} />
            </label>
          </div>
          <div className="till-book-floor">
            <ZoneChips zones={zones} zoneId={zoneId} onPick={setZoneId} />
            <FloorMap tables={records} state={state} selectedId={tableId} onSelect={pickTable} at={previewAt} preview />
          </div>
        </div>
      </main>
      <aside className="till-book-pane">
        {selectedParty ? (
          <>
            <h2>This party</h2>
            <PartyCard state={state} party={selectedParty} selected />
            {selectedParty.status === "booked" && selectedParty.id ? (
              <div className="till-diary-actions">
                {selectedParty.tableId ? (
                  <button type="button" className="till-primary" onClick={() => seat(selectedParty.id).then((r) => flash(r, `Seated ${selectedParty.name}`))}>
                    Seat
                  </button>
                ) : (
                  <select
                    aria-label={`Hold a table for ${selectedParty.name}`}
                    defaultValue=""
                    onChange={(e) => {
                      const id = e.target.value;
                      if (!id) return;
                      holdTable(selectedParty.id, id).then((r) => flash(r, r.ok ? `Held ${id}` : r.error));
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
                <button type="button" className="till-ghost" onClick={() => noShow(selectedParty.id).then((r) => flash(r, "Marked no show"))}>
                  No show
                </button>
                <button type="button" className="till-ghost" onClick={() => cancelBook(selectedParty.id).then((r) => flash(r, "Cancelled"))}>
                  Cancel
                </button>
              </div>
            ) : null}
          </>
        ) : (
          <h2>Who’s coming?</h2>
        )}
        <div className="till-book-add">
          <label className="till-name till-book-add-wide">
            Name
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Sam" />
          </label>
          <label className="till-name">
            Guests
            <input type="number" min="1" max="99" value={covers} onChange={(e) => setCovers(e.target.value)} />
          </label>
          <label className="till-name till-book-add-wide">
            Phone
            <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Optional" />
          </label>
        </div>
        <p className="till-muted">
          {formatClock(previewAt)}
          {tableId ? ` · Table ${tableId}` : " · no table yet"}
        </p>
        <button type="button" className="till-primary" onClick={add}>
          Add to the book
        </button>
        {notice ? (
          <p className={/^(Booked|Seated|Held|Marked|Cancelled)/.test(notice) ? "till-ok" : "till-error"}>{notice}</p>
        ) : null}
        <ul className="till-diary">
          {diary.length === 0 ? <li className="till-muted">No names this day. Walk-ins use the floor.</li> : null}
          {diary.map((b) => (
            <li key={b.id}>
              <PartyCard
                state={state}
                party={b}
                selected={pickedId === b.id}
                onSelect={() => {
                  setPickedId(b.id);
                  setTableId(b.tableId);
                }}
              />
            </li>
          ))}
        </ul>
      </aside>
    </>
  );
}
