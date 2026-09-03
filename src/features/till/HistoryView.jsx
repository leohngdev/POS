import { useMemo, useState } from "react";
import { money } from "../../services/pos";
import { usePos } from "./PosProvider";
import { printReceipt, ReceiptBody } from "./Receipt";

export function HistoryView() {
  const { state, venue } = usePos();
  const [q, setQ] = useState("");
  const [selectedId, setSelectedId] = useState(null);
  const receipts = state.receipts ?? [];
  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return receipts;
    return receipts.filter((r) => {
      const blob = [r.id, r.tableId, r.queueNumber, r.guestName, r.guestPhone, r.paidVia, r.venueName]
        .join(" ")
        .toLowerCase();
      return blob.includes(needle);
    });
  }, [q, receipts]);
  const selected = filtered.find((r) => r.id === selectedId) ?? filtered[0] ?? null;

  return (
    <>
      <main className="till-workspace">
        <div className="till-page-head">
          <h1>History</h1>
          <label className="till-name till-find">
            Find
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Table, name, T-01" />
          </label>
        </div>
        {filtered.length === 0 ? (
          <p className="till-empty">No receipts yet</p>
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
                <span>{r.guestName || r.paidVia || "Paid"}</span>
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
          </>
        ) : (
          <>
            <h2>{venue.name}</h2>
            <p className="till-muted">Nothing to reprint</p>
          </>
        )}
      </aside>
    </>
  );
}
