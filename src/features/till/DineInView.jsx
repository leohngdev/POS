import { useMemo, useState } from "react";
import { compactLines, openCheckForTable, tableClaimStatus, tableFloorStatus } from "../../services/pos";
import { usePos } from "./PosProvider";
import { MenuGrid } from "./MenuGrid";
import { BillPanel } from "./BillPanel";
import { ClaimActions } from "./ClaimActions";

function bumpQty(map, id, delta) {
  const next = { ...map, [id]: Math.max(0, (map[id] ?? 0) + delta) };
  if (next[id] === 0) delete next[id];
  return next;
}

function tableClass(id, selected, claim, floor, small) {
  const parts = [small ? "till-table till-table-sm" : "till-table"];
  if (selected) parts.push("on");
  if (claim === "pending") parts.push("claimed");
  if (claim === "accepted") parts.push("seated");
  if (floor === "cooking" || floor === "ready") parts.push(floor);
  return parts.join(" ");
}

function tableTags(claim, floor) {
  const floorTag = floor === "cooking" ? "Cooking" : floor === "ready" ? "To pay" : null;
  const guestTag = claim === "pending" ? "Guest" : claim === "accepted" ? "Seated" : null;
  return { guestTag, floorTag: claim === "pending" ? null : floorTag };
}

export function DineInView() {
  const { state, venue, sendOrder, reject, accept } = usePos();
  const [tableId, setTableId] = useState(null);
  const [draft, setDraft] = useState({});
  const [notice, setNotice] = useState(null);

  const openCheck = tableId ? openCheckForTable(state.checks, tableId) : null;
  const ordering = Boolean(tableId);
  const lines = useMemo(() => compactLines(draft, venue.menu), [draft, venue.menu]);
  const billLines = lines.length ? lines : openCheck?.lines ?? [];
  const selectedClaim = tableId ? tableClaimStatus(state, tableId) : null;

  function chooseTable(id) {
    setTableId(id);
    setDraft({});
    setNotice(null);
  }

  function send() {
    sendOrder({
      channel: "dine-in",
      tableId,
      lines,
    }).then((result) => {
      if (!result.ok) {
        setNotice(result.error);
        return;
      }
      setDraft({});
      setNotice("Sent to kitchen");
    });
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
                {venue.tables.map((id) => {
                  const claim = tableClaimStatus(state, id);
                  const floor = tableFloorStatus(state, id);
                  const { guestTag, floorTag } = tableTags(claim, floor);
                  return (
                    <div key={`${id}-${state.guestClaims?.[id]?.at ?? "open"}`} className="till-table-cell">
                      <button
                        type="button"
                        className={tableClass(id, tableId === id, claim, floor, false)}
                        onClick={() => chooseTable(id)}
                      >
                        {id}
                        {guestTag ? <span className="till-claim-tag">{guestTag}</span> : null}
                        {floorTag ? <span className="till-claim-tag">{floorTag}</span> : null}
                      </button>
                      <ClaimActions status={claim} onAccept={() => accept(id)} onReject={() => reject(id)} />
                    </div>
                  );
                })}
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
                  className={tableClass(id, tableId === id, tableClaimStatus(state, id), tableFloorStatus(state, id), true)}
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
        lines={billLines}
        venue={venue}
        extra={
          selectedClaim === "pending" ? (
            <p className="till-muted">Guest claimed this table. Accept to seat them, or Reject to kick them off.</p>
          ) : openCheck && lines.length === 0 ? (
            <p className="till-muted">Open check {openCheck.id}. Add items and Send for MORE.</p>
          ) : openCheck ? (
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
        {ordering ? (
          <ClaimActions status={selectedClaim} onAccept={() => accept(tableId)} onReject={() => reject(tableId)} />
        ) : null}
        {notice ? <p className={notice.startsWith("Sent") ? "till-ok" : "till-error"}>{notice}</p> : null}
      </BillPanel>
    </>
  );
}
