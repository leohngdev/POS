import { useMemo, useState } from "react";
import {
  amountDue,
  compactLines,
  canVoidLastSend,
  moveTargets,
  openCheckForTable,
  tableClaimStatus,
  tableFloorStatus,
} from "../../services/pos";
import { usePos } from "./PosProvider";
import { MenuGrid } from "./MenuGrid";
import { BillPanel, PayPad } from "./BillPanel";
import { ClaimActions } from "./ClaimActions";
import { TableOps } from "./TableOps";

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
  const { state, venue, sendOrder, reject, accept, move, voidSend, pay, setCovers, setDiscount } = usePos();
  const [tableId, setTableId] = useState(null);
  const [draft, setDraft] = useState({});
  const [notes, setNotes] = useState({});
  const [notice, setNotice] = useState(null);
  const [moving, setMoving] = useState(false);
  const [draftCovers, setDraftCovers] = useState(0);
  const [draftDiscount, setDraftDiscount] = useState(0);
  const [tenderAmt, setTenderAmt] = useState("");

  const openCheck = tableId ? openCheckForTable(state.checks, tableId) : null;
  const ordering = Boolean(tableId);
  const lines = useMemo(() => compactLines(draft, venue.menu, notes), [draft, venue.menu, notes]);
  const billLines = lines.length ? lines : openCheck?.lines ?? [];
  const selectedClaim = tableId ? tableClaimStatus(state, tableId) : null;
  const targets = tableId ? moveTargets(state, venue.tables, tableId) : [];
  const coversValue = openCheck ? openCheck.covers ?? 0 : draftCovers;
  const discountPct = openCheck ? Math.round((openCheck.discountRate ?? 0) * 1000) / 10 : draftDiscount;

  function chooseTable(id) {
    setTableId(id);
    setDraft({});
    setNotes({});
    setNotice(null);
    setMoving(false);
    setTenderAmt("");
    const check = openCheckForTable(state.checks, id);
    setDraftCovers(check?.covers ?? 0);
    setDraftDiscount(Math.round((check?.discountRate ?? 0) * 1000) / 10);
  }

  function backToFloor() {
    setTableId(null);
    setDraft({});
    setNotes({});
    setNotice(null);
    setMoving(false);
    setTenderAmt("");
  }

  function send() {
    sendOrder({
      channel: "dine-in",
      tableId,
      lines,
      covers: coversValue,
      discountRate: discountPct / 100,
    }).then((result) => {
      if (!result.ok) {
        setNotice(result.error);
        return;
      }
      setDraft({});
      setNotes({});
      setNotice("Sent to kitchen");
    });
  }

  function onCovers(raw) {
    const n = Number(raw);
    if (openCheck) {
      setCovers(openCheck.id, n);
      return;
    }
    setDraftCovers(n);
  }

  function onDiscount(raw) {
    const n = Number(raw);
    if (Number.isNaN(n)) return;
    if (openCheck) {
      setDiscount(openCheck.id, n / 100);
      return;
    }
    setDraftDiscount(n);
  }

  function settle(via) {
    if (!openCheck) return;
    const amount = tenderAmt === "" ? undefined : Number(tenderAmt);
    pay(openCheck.id, via, amount).then((result) => {
      if (!result.ok) {
        setNotice(result.error);
        return;
      }
      setTenderAmt("");
      setNotice(result.state.checks.find((c) => c.id === openCheck.id)?.status === "paid" ? `Paid · ${via}` : `Tendered ${via}`);
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
              <button type="button" className="till-table till-table-sm" onClick={backToFloor}>
                Floor
              </button>
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
              notesByItem={notes}
              disabled={false}
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
          </>
        )}
      </main>
      <BillPanel
        title={tableId ? `Table ${tableId}` : "No table yet"}
        lines={billLines}
        venue={venue}
        check={lines.length ? undefined : openCheck}
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
          <div className="till-check-meta">
            <label className="till-name">
              Covers
              <input
                type="number"
                min="0"
                max="99"
                value={coversValue}
                onChange={(e) => onCovers(e.target.value)}
              />
            </label>
            <label className="till-name">
              Discount %
              <input
                type="number"
                min="0"
                max="100"
                step="0.5"
                value={discountPct}
                onChange={(e) => onDiscount(e.target.value)}
              />
            </label>
          </div>
        ) : null}
        {ordering ? (
          <ClaimActions status={selectedClaim} onAccept={() => accept(tableId)} onReject={() => reject(tableId)} />
        ) : null}
        {ordering ? (
          <TableOps
            showMove={Boolean(openCheck || selectedClaim)}
            targets={targets}
            moving={moving}
            onToggleMove={() => setMoving((m) => !m)}
            onMoveTo={(id) => {
              move(tableId, id).then((result) => {
                if (!result.ok) {
                  setNotice(result.error);
                  return;
                }
                setTableId(id);
                setMoving(false);
                setNotice(`Moved to ${id}`);
              });
            }}
            canVoid={openCheck ? canVoidLastSend(state, openCheck.id) : false}
            onVoid={
              openCheck
                ? () => {
                    voidSend(openCheck.id).then((result) => {
                      if (!result.ok) {
                        setNotice(result.error);
                        return;
                      }
                      setNotice("Voided last Send");
                    });
                  }
                : undefined
            }
          />
        ) : null}
        {openCheck && lines.length === 0 ? (
          <PayPad
            due={amountDue(openCheck, venue)}
            amount={tenderAmt}
            onAmount={setTenderAmt}
            onPay={settle}
            disabled={openCheck.status !== "open"}
          />
        ) : null}
        {notice ? (
          <p
            className={
              notice.startsWith("Sent") ||
              notice.startsWith("Moved") ||
              notice.startsWith("Voided") ||
              notice.startsWith("Paid") ||
              notice.startsWith("Tendered")
                ? "till-ok"
                : "till-error"
            }
          >
            {notice}
          </p>
        ) : null}
      </BillPanel>
    </>
  );
}
