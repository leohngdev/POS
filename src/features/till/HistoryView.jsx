import { useMemo, useState } from "react";
import { isBoss, money } from "../../services/pos";
import { usePos } from "./PosProvider";
import { printReceipt, ReceiptBody } from "./Receipt";
import { HISTORY_EMPTY, HISTORY_NONE, receiptWhen } from "./ticketsCopy";

export function HistoryView() {
  const { state, venue, closeNight } = usePos();
  const boss = isBoss(state.onStaff);
  const [q, setQ] = useState("");
  const [selectedId, setSelectedId] = useState(null);
  const [notice, setNotice] = useState(null);
  const receipts = state.receipts ?? [];
  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return receipts;
    return receipts.filter((r) => {
      const when = receiptWhen(r);
      const blob = [r.id, r.tableId, r.queueNumber, r.guestName, r.guestPhone, r.paidVia, r.venueName, when]
        .join(" ")
        .toLowerCase();
      return blob.includes(needle);
    });
  }, [q, receipts]);
  const selected = filtered.find((r) => r.id === selectedId) ?? filtered[0] ?? null;

  function close() {
    closeNight().then((r) => setNotice(r.ok ? "Night closed — hours stay on Roster" : r.error));
  }

  return (
    <>
      <main className="till-workspace">
        <div className="till-page-head">
          <h1>History</h1>
          <label className="till-name till-find">
            Find
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Table, name, T-01, date" />
          </label>
        </div>
        {filtered.length === 0 ? (
          <p className="till-empty">{HISTORY_EMPTY}</p>
        ) : (
          <div className="till-ticket-row">
            {filtered.map((r) => (
              <button
                key={r.id}
                type="button"
                className={`till-ticket${selected?.id === r.id ? " on" : ""}`}
                onClick={() => setSelectedId(r.id)}
              >
                <strong>{r.channel === "takeaway" ? r.queueNumber : `Table ${r.tableId}`}</strong>
                <span>{[r.guestName || r.paidVia || "Paid", receiptWhen(r)].filter(Boolean).join(" · ")}</span>
                <span className="till-chip">{money(r.total)}</span>
              </button>
            ))}
          </div>
        )}
      </main>
      <aside className="till-context">
        {selected ? (
          <>
            <ReceiptBody receipt={selected} />
            <button type="button" className="till-primary" onClick={() => printReceipt(selected)}>
              Print receipt
            </button>
            {boss ? (
              <button type="button" className="till-ghost" onClick={close}>
                End of night
              </button>
            ) : null}
          </>
        ) : (
          <>
            <h2>{venue.name}</h2>
            <p className="till-muted">{HISTORY_NONE}</p>
            {boss ? (
              <button type="button" className="till-ghost" onClick={close}>
                End of night
              </button>
            ) : null}
          </>
        )}
        {notice ? <p className={notice.startsWith("Night") ? "till-ok" : "till-error"}>{notice}</p> : null}
      </aside>
    </>
  );
}
