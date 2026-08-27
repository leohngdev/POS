import { useEffect, useMemo, useState } from "react";
import {
  CLAIM_REQUIRED,
  compactLines,
  hasGuestClaim,
  lastPaidCheckForTable,
  lineTotal,
  money,
  liveTables,
  liveZones,
  tablesInZone,
  normalizeTableId,
  openCheckForTable,
  tableClaimStatus,
} from "../../services/pos";
import { usePos } from "../till/PosProvider";
import { CheckTotals } from "../till/BillPanel";
import { MenuGrid } from "../till/MenuGrid";

function bumpQty(map, id, delta) {
  const next = { ...map, [id]: Math.max(0, (map[id] ?? 0) + delta) };
  if (next[id] === 0) delete next[id];
  return next;
}

function GuestBill({ check, venue }) {
  return (
    <section className="guest-bill">
      <h2>This table’s check</h2>
      <ul className="till-lines">
        {check.lines.map((line) => (
          <li key={`${line.itemId}-${line.note ?? ""}`}>
            <span>
              x{line.qty} {line.name}
              {line.note ? <em className="till-line-note"> — {line.note}</em> : null}
            </span>
            <span>{money(lineTotal(line))}</span>
          </li>
        ))}
      </ul>
      <CheckTotals check={check} venue={venue} />
    </section>
  );
}

export function GuestOrder({ initialTable }) {
  const { state, venue, sendOrder, claim, release, pay } = usePos();
  const [tableId, setTableId] = useState(null);
  const [typed, setTyped] = useState("");
  const [zoneId, setZoneId] = useState("all");
  const [draft, setDraft] = useState({});
  const [notes, setNotes] = useState({});
  const [notice, setNotice] = useState(null);
  const lines = useMemo(() => compactLines(draft, venue.menu, notes), [draft, venue.menu, notes]);
  const openCheck = tableId ? openCheckForTable(state.checks, tableId) : null;
  const lastPaid = tableId && !openCheck ? lastPaidCheckForTable(state.checks, tableId) : null;
  const seated = tableId ? tableClaimStatus(state, tableId) === "accepted" : false;

  function guestStatusCopy() {
    if (openCheck) {
      return seated
        ? "This is the table check. Send adds MORE. Card/Cash marks it paid — same as the till, no card machine."
        : "Sent. The floor can still see you pulsing until they Accept.";
    }
    if (lastPaid) {
      return seated
        ? `Last check paid · ${lastPaid.paidVia}. Send starts a new check.`
        : `Last check paid · ${lastPaid.paidVia}. Waiting for the floor to Accept.`;
    }
    return seated
      ? "You're seated. First order from this table."
      : "The floor can see this table. They Accept to seat you. You can still Send.";
  }

  async function pick(id) {
    if (tableId && tableId !== id) await release(tableId);
    const result = await claim(id);
    if (!result.ok) {
      setNotice(result.error);
      return;
    }
    setTableId(id);
    setDraft({});
    setNotes({});
    setNotice(null);
  }

  useEffect(() => {
    if (!initialTable) return;
    const id = normalizeTableId(initialTable, liveTables(venue));
    if (!id) {
      setNotice("That table is not on this floor.");
      return;
    }
    pick(id);
    // claim/reject always read latest store; run once per QR table
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialTable]);

  useEffect(() => {
    if (!tableId || hasGuestClaim(state, tableId)) return;
    setTableId(null);
    setDraft({});
    setNotes({});
    setNotice(CLAIM_REQUIRED);
  }, [tableId, state.guestClaims]);

  function submitTyped() {
    const id = normalizeTableId(typed, liveTables(venue));
    if (!id) {
      setNotice("That table is not on this floor.");
      return;
    }
    pick(id);
  }

  async function changeTable() {
    if (tableId) await release(tableId);
    setTableId(null);
    setDraft({});
    setNotes({});
    setNotice(null);
  }

  async function send() {
    const result = await sendOrder({ channel: "dine-in", tableId, lines, requireClaim: true });
    if (!result.ok) {
      setNotice(result.error);
      if (!hasGuestClaim(result.state, tableId)) {
        setTableId(null);
        setDraft({});
        setNotes({});
      }
      return;
    }
    setDraft({});
    setNotes({});
    setNotice("Sent to kitchen");
  }

  async function settle(via) {
    if (!openCheck) return;
    const result = await pay(openCheck.id, via);
    if (!result.ok) {
      setNotice(result.error);
      return;
    }
    setDraft({});
    setNotes({});
    setNotice(via === "card" ? "Paid · card" : "Paid · cash");
  }

  return (
    <div className="till-root guest-root">
      <p className="till-eyebrow">Order at the table</p>
      {!tableId ? (
        <>
          <h1>Which table?</h1>
          <p className="till-muted">Type what’s printed on the table — 4, 1a, 17 — or tap it. No staff PIN.</p>
          <div className="guest-type">
            <input
              placeholder="1a"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              aria-label="Table"
              autoCapitalize="off"
              autoCorrect="off"
            />
            <button type="button" className="till-primary" onClick={submitTyped}>
              Claim
            </button>
          </div>
          {notice ? <p className="till-error">{notice}</p> : null}
          {liveZones(venue).length > 1 ? (
            <div className="till-strip">
              <button type="button" className={zoneId === "all" ? "till-table till-table-sm on" : "till-table till-table-sm"} onClick={() => setZoneId("all")}>
                All
              </button>
              {liveZones(venue).map((z) => (
                <button
                  key={z.id}
                  type="button"
                  className={zoneId === z.id ? "till-table till-table-sm on" : "till-table till-table-sm"}
                  onClick={() => setZoneId(z.id)}
                >
                  {z.name}
                </button>
              ))}
            </div>
          ) : null}
          <div className="till-map">
            {tablesInZone(venue, zoneId).map((t) => (
              <button key={t.id} type="button" className="till-table" onClick={() => pick(t.id)}>
                {t.id}
              </button>
            ))}
          </div>
        </>
      ) : (
        <>
          <h1>Table {tableId}</h1>
          <p className="till-muted">{guestStatusCopy()}</p>
          <button type="button" className="till-ghost guest-change" onClick={changeTable}>
            Change table
          </button>
          <MenuGrid
            menu={venue.menu}
            qtyByItem={draft}
            notesByItem={notes}
            onAdd={(id) => {
              setNotice(null);
              setDraft((d) => bumpQty(d, id, 1));
            }}
            onRemove={(id) => {
              setDraft((d) => {
                const next = bumpQty(d, id, -1);
                if (!next[id]) {
                  setNotes((n) => {
                    const copy = { ...n };
                    delete copy[id];
                    return copy;
                  });
                }
                return next;
              });
            }}
            onNote={(id, text) => setNotes((n) => ({ ...n, [id]: text }))}
          />
          {openCheck ? <GuestBill check={openCheck} venue={venue} /> : null}
          {notice ? (
            <p className={notice.startsWith("Sent") || notice.startsWith("Paid") ? "till-ok" : "till-error"}>
              {notice}
            </p>
          ) : null}
          <button type="button" className="till-primary" disabled={lines.length === 0} onClick={send}>
            Send to kitchen
          </button>
          {openCheck ? (
            <div className="till-pay-pair">
              <button type="button" className="till-primary" onClick={() => settle("card")}>
                Card
              </button>
              <button type="button" className="till-primary" onClick={() => settle("cash")}>
                Cash
              </button>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
