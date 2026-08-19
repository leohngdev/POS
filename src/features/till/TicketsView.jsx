import { useState } from "react";
import { checkLabel, checkTotal, money } from "../../services/pos";
import { usePos } from "./PosProvider";
import { BillPanel } from "./BillPanel";

export function TicketsView() {
  const { state, venue, pay } = usePos();
  const [selectedId, setSelectedId] = useState(null);
  const [notice, setNotice] = useState(null);

  const unpaid = state.checks.filter((c) => c.status === "open");
  const paid = state.checks.filter((c) => c.status === "paid");
  const selected = state.checks.find((c) => c.id === selectedId) ?? null;

  function settle(via) {
    if (!selected || selected.status === "paid") return;
    const result = pay(selected.id, via);
    if (!result.ok) {
      setNotice(result.error);
      return;
    }
    setNotice(`Marked ${via}`);
  }

  return (
    <>
      <main className="till-workspace">
        {state.checks.length === 0 ? (
          <p className="till-empty">No open tickets</p>
        ) : (
          <>
            <h2>To pay</h2>
            <div className="till-ticket-row">
              {unpaid.length === 0 ? <p className="till-muted">Nothing unpaid</p> : null}
              {unpaid.map((check) => (
                <button
                  key={check.id}
                  type="button"
                  className={selectedId === check.id ? "till-ticket on" : "till-ticket"}
                  onClick={() => {
                    setSelectedId(check.id);
                    setNotice(null);
                  }}
                >
                  <strong>{checkLabel(check)}</strong>
                  <span>Unpaid · {money(checkTotal(check, venue))}</span>
                  <span className="till-chip">Pay now</span>
                </button>
              ))}
            </div>
            <h2>Paid</h2>
            <div className="till-ticket-row">
              {paid.length === 0 ? <p className="till-muted">None yet</p> : null}
              {paid.map((check) => (
                <button
                  key={check.id}
                  type="button"
                  className={selectedId === check.id ? "till-ticket paid on" : "till-ticket paid"}
                  onClick={() => setSelectedId(check.id)}
                >
                  <strong>{checkLabel(check)}</strong>
                  <span>Paid · {money(checkTotal(check, venue))}</span>
                </button>
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
          extra={<p className="till-muted">{selected.status === "paid" ? `Paid · ${selected.paidVia}` : "Unpaid"}</p>}
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
