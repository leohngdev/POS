import { useEffect, useMemo, useState } from "react";
import {
  CLAIM_REQUIRED,
  checkSubtotal,
  checkTotal,
  compactLines,
  hasGuestClaim,
  lastPaidCheckForTable,
  lineTotal,
  money,
  normalizeTableId,
  openCheckForTable,
} from "../../services/pos";
import { usePos } from "../till/PosProvider";
import { MenuGrid } from "../till/MenuGrid";

function bumpQty(map, id, delta) {
  const next = { ...map, [id]: Math.max(0, (map[id] ?? 0) + delta) };
  if (next[id] === 0) delete next[id];
  return next;
}

function GuestBill({ check, venue }) {
  const sub = checkSubtotal(check);
  const total = checkTotal(check, venue);
  return (
    <section className="guest-bill">
      <h2>This table’s check</h2>
      <ul className="till-lines">
        {check.lines.map((line) => (
          <li key={line.itemId}>
            x{line.qty} {line.name}
            <span>{money(lineTotal(line))}</span>
          </li>
        ))}
      </ul>
      <div className="till-totals">
        <div>
          <span>Subtotal</span>
          <span>{money(sub)}</span>
        </div>
        {venue.gstEnabled ? (
          <div>
            <span>GST</span>
            <span>{money(sub * venue.gstRate)}</span>
          </div>
        ) : null}
        {venue.surchargeEnabled ? (
          <div>
            <span>Surcharge</span>
            <span>{money(sub * venue.surchargeRate)}</span>
          </div>
        ) : null}
        <div className="till-grand">
          <span>Total</span>
          <span>{money(total)}</span>
        </div>
      </div>
    </section>
  );
}

export function GuestOrder({ initialTable }) {
  const { state, venue, sendOrder, claim, release, pay } = usePos();
  const [tableId, setTableId] = useState(null);
  const [typed, setTyped] = useState("");
  const [draft, setDraft] = useState({});
  const [notice, setNotice] = useState(null);
  const lines = useMemo(() => compactLines(draft, venue.menu), [draft, venue.menu]);
  const openCheck = tableId ? openCheckForTable(state.checks, tableId) : null;
  const lastPaid = tableId && !openCheck ? lastPaidCheckForTable(state.checks, tableId) : null;

  async function pick(id) {
    if (tableId && tableId !== id) await release(tableId);
    const result = await claim(id);
    if (!result.ok) {
      setNotice(result.error);
      return;
    }
    setTableId(id);
    setDraft({});
    setNotice(null);
  }

  useEffect(() => {
    if (!initialTable) return;
    const id = normalizeTableId(initialTable, venue.tables);
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
    setNotice(CLAIM_REQUIRED);
  }, [tableId, state.guestClaims]);

  function submitTyped() {
    const id = normalizeTableId(typed, venue.tables);
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
    setNotice(null);
  }

  async function send() {
    const result = await sendOrder({ channel: "dine-in", tableId, lines, requireClaim: true });
    if (!result.ok) {
      setNotice(result.error);
      if (!hasGuestClaim(result.state, tableId)) {
        setTableId(null);
        setDraft({});
      }
      return;
    }
    setDraft({});
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
    setNotice(via === "card" ? "Paid · card" : "Paid · cash");
  }

  return (
    <div className="till-root guest-root">
      <p className="till-eyebrow">Order at the table</p>
      {!tableId ? (
        <>
          <h1>Which table?</h1>
          <p className="till-muted">Type the number on the table, or tap it. No staff PIN.</p>
          <div className="guest-type">
            <input
              inputMode="numeric"
              placeholder="04"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              aria-label="Table number"
            />
            <button type="button" className="till-primary" onClick={submitTyped}>
              Claim
            </button>
          </div>
          {notice ? <p className="till-error">{notice}</p> : null}
          <div className="till-map">
            {venue.tables.map((id) => (
              <button key={id} type="button" className="till-table" onClick={() => pick(id)}>
                {id}
              </button>
            ))}
          </div>
        </>
      ) : (
        <>
          <h1>Table {tableId}</h1>
          <p className="till-muted">
            {openCheck
              ? "This is the table check. Send adds MORE. Card/Cash marks it paid — same as the till, no card machine."
              : lastPaid
                ? `Last check paid · ${lastPaid.paidVia}. Send starts a new check.`
                : "First order from this table."}
          </p>
          <button type="button" className="till-ghost guest-change" onClick={changeTable}>
            Change table
          </button>
          <MenuGrid
            menu={venue.menu}
            qtyByItem={draft}
            onAdd={(id) => {
              setNotice(null);
              setDraft((d) => bumpQty(d, id, 1));
            }}
            onRemove={(id) => setDraft((d) => bumpQty(d, id, -1))}
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
