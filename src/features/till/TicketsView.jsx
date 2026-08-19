import { useState } from "react";
import { checkFloorStatus, checkLabel, checkTotal, money } from "../../services/pos";
import { usePos } from "./PosProvider";
import { BillPanel } from "./BillPanel";

function TicketCard({ check, venue, chits, selected, onSelect }) {
  const floor = checkFloorStatus(check, chits);
  const label = floor === "paid" ? "Paid" : floor === "cooking" ? "Cooking" : "Pay now";
  return (
    <button
      type="button"
      className={`till-ticket${selected ? " on" : ""}${floor === "paid" ? " paid" : ""}`}
      onClick={onSelect}
    >
      <strong>{checkLabel(check)}</strong>
      <span>
        {label} · {money(checkTotal(check, venue))}
      </span>
      <span className="till-chip">{label}</span>
    </button>
  );
}

export function TicketsView() {
  const { state, venue, pay } = usePos();
  const [selectedId, setSelectedId] = useState(null);
  const [notice, setNotice] = useState(null);

  const cooking = state.checks.filter((c) => checkFloorStatus(c, state.chits) === "cooking");
  const ready = state.checks.filter((c) => checkFloorStatus(c, state.chits) === "ready");
  const paid = state.checks.filter((c) => c.status === "paid");
  const selected = state.checks.find((c) => c.id === selectedId) ?? null;
  const selectedFloor = selected ? checkFloorStatus(selected, state.chits) : null;

  async function settle(via) {
    if (!selected || selected.status === "paid") return;
    const result = await pay(selected.id, via);
    if (!result.ok) {
      setNotice(result.error);
      return;
    }
    setNotice(`Marked ${via}`);
  }

  function pick(id) {
    setSelectedId(id);
    setNotice(null);
  }

  return (
    <>
      <main className="till-workspace">
        {state.checks.length === 0 ? (
          <p className="till-empty">No open tickets</p>
        ) : (
          <>
            <h2>In progress</h2>
            <div className="till-ticket-row">
              {cooking.length === 0 ? <p className="till-muted">Kitchen is clear</p> : null}
              {cooking.map((check) => (
                <TicketCard
                  key={check.id}
                  check={check}
                  venue={venue}
                  chits={state.chits}
                  selected={selectedId === check.id}
                  onSelect={() => pick(check.id)}
                />
              ))}
            </div>
            <h2>To pay</h2>
            <div className="till-ticket-row">
              {ready.length === 0 ? <p className="till-muted">Nothing waiting on payment</p> : null}
              {ready.map((check) => (
                <TicketCard
                  key={check.id}
                  check={check}
                  venue={venue}
                  chits={state.chits}
                  selected={selectedId === check.id}
                  onSelect={() => pick(check.id)}
                />
              ))}
            </div>
            <h2>Paid</h2>
            <div className="till-ticket-row">
              {paid.length === 0 ? <p className="till-muted">None yet</p> : null}
              {paid.map((check) => (
                <TicketCard
                  key={check.id}
                  check={check}
                  venue={venue}
                  chits={state.chits}
                  selected={selectedId === check.id}
                  onSelect={() => pick(check.id)}
                />
              ))}
            </div>
          </>
        )}
      </main>
      {selected ? (
        <BillPanel
          title={checkLabel(selected)}
          lines={selected.lines}
          venue={venue}
          extra={
            <p className="till-muted">
              {selectedFloor === "paid"
                ? `Paid · ${selected.paidVia}`
                : selectedFloor === "cooking"
                  ? "Kitchen still has a chit"
                  : "Ready to pay"}
            </p>
          }
        >
          {notice ? <p className="till-ok">{notice}</p> : null}
          {selected.status === "open" ? (
            <div className="till-pay-pair">
              <button type="button" className="till-primary" onClick={() => settle("card")}>
                Card
              </button>
              <button type="button" className="till-primary" onClick={() => settle("cash")}>
                Cash
              </button>
            </div>
          ) : null}
        </BillPanel>
      ) : (
        <aside className="till-context">
          <h2>—</h2>
          <p className="till-muted">Select a check</p>
          <button type="button" className="till-primary" disabled>
            Card / Cash
          </button>
        </aside>
      )}
    </>
  );
}
