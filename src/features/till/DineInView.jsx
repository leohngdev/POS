import { useMemo, useState } from "react";
import { compactLines, openCheckForTable } from "../../services/pos";
import { usePos } from "./PosProvider";
import { MenuGrid } from "./MenuGrid";
import { BillPanel } from "./BillPanel";

function bumpQty(map, id, delta) {
  const next = { ...map, [id]: Math.max(0, (map[id] ?? 0) + delta) };
  if (next[id] === 0) delete next[id];
  return next;
}

export function DineInView() {
  const { state, venue, sendOrder } = usePos();
  const [tableId, setTableId] = useState(null);
  const [draft, setDraft] = useState({});
  const [notice, setNotice] = useState(null);

  const openCheck = tableId ? openCheckForTable(state.checks, tableId) : null;
  const ordering = Boolean(tableId);
  const lines = useMemo(() => compactLines(draft, venue.menu), [draft, venue.menu]);

  function chooseTable(id) {
    setTableId(id);
    setDraft({});
    setNotice(null);
  }

  function send() {
    const result = sendOrder({
      channel: "dine-in",
      tableId,
      lines,
    });
    if (!result.ok) {
      setNotice(result.error);
      return;
    }
    setDraft({});
    setNotice("Sent to kitchen");
  }

  return (
    <>
      <main className="till-workspace">
        {!ordering ? (
          <>
            <h1>Floor</h1>
            {venue.tables.length === 0 ? (
              <p className="till-empty">No tables configured</p>
            ) : (
              <div className="till-map">
                {venue.tables.map((id) => (
                  <button
                    key={id}
                    type="button"
                    className={tableId === id ? "till-table on" : "till-table"}
                    onClick={() => chooseTable(id)}
                  >
                    {id}
                  </button>
                ))}
              </div>
            )}
          </>
        ) : (
          <>
            <div className="till-strip">
              {venue.tables.map((id) => (
                <button
                  key={id}
                  type="button"
                  className={tableId === id ? "till-table till-table-sm on" : "till-table till-table-sm"}
                  onClick={() => chooseTable(id)}
                >
                  {id}
                </button>
              ))}
            </div>
            <MenuGrid
              menu={venue.menu}
              qtyByItem={draft}
              disabled={false}
              onAdd={(id) => {
                setNotice(null);
                setDraft((d) => bumpQty(d, id, 1));
              }}
              onRemove={(id) => setDraft((d) => bumpQty(d, id, -1))}
            />
          </>
        )}
      </main>
      <BillPanel
        title={tableId ? `Table ${tableId}` : "No table yet"}
        lines={lines}
        venue={venue}
        extra={
          openCheck ? (
            <p className="till-muted">Open check {openCheck.id}. Send again appends and fires MORE.</p>
          ) : tableId ? (
            <p className="till-muted">New check on Send.</p>
          ) : (
            <p className="till-muted">Pick a table on the floor.</p>
          )
        }
        primaryLabel="Send"
        primaryDisabled={!tableId || lines.length === 0}
        onPrimary={tableId ? send : undefined}
      >
        {notice ? <p className={notice.startsWith("Sent") ? "till-ok" : "till-error"}>{notice}</p> : null}
      </BillPanel>
    </>
  );
}
