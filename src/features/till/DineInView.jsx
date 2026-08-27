import { useMemo, useState } from "react";
import {
  amountDue,
  compactLines,
  canVoidLastSend,
  liveTables,
  makeReceipt,
  moveTargets,
  openCheckForTable,
  tableClaimStatus,
  tableFloorStatus,
  tableRecords,
} from "../../services/pos";
import { usePos } from "./PosProvider";
import { MenuGrid } from "./MenuGrid";
import { BillPanel, PayPad } from "./BillPanel";
import { ClaimActions } from "./ClaimActions";
import { TableOps } from "./TableOps";
import { FloorMap } from "./FloorMap";
import { OfferPad } from "./OfferPad";
import { printReceipt } from "./Receipt";

function bumpQty(map, id, delta) {
  const next = { ...map, [id]: Math.max(0, (map[id] ?? 0) + delta) };
  if (next[id] === 0) delete next[id];
  return next;
}

function tableClass(selected, claim, floor, small) {
  const parts = [small ? "till-table till-table-sm" : "till-table"];
  if (selected) parts.push("on");
  if (claim === "pending") parts.push("claimed");
  if (claim === "accepted") parts.push("seated");
  if (floor === "cooking" || floor === "ready") parts.push(floor);
  return parts.join(" ");
}

export function DineInView() {
  const {
    state,
    venue,
    sendOrder,
    reject,
    accept,
    move,
    voidSend,
    pay,
    setCovers,
    addCheckOffer,
    dropCheckOffer,
  } = usePos();
  const [tableId, setTableId] = useState(null);
  const [draft, setDraft] = useState({});
  const [notes, setNotes] = useState({});
  const [notice, setNotice] = useState(null);
  const [moving, setMoving] = useState(false);
  const [draftGuests, setDraftGuests] = useState(0);
  const [tenderAmt, setTenderAmt] = useState("");
  const ids = liveTables(venue);
  const records = tableRecords(venue);

  const openCheck = tableId ? openCheckForTable(state.checks, tableId) : null;
  const ordering = Boolean(tableId);
  const lines = useMemo(() => compactLines(draft, venue.menu, notes), [draft, venue.menu, notes]);
  const billLines = lines.length ? lines : openCheck?.lines ?? [];
  const selectedClaim = tableId ? tableClaimStatus(state, tableId) : null;
  const targets = tableId ? moveTargets(state, ids, tableId) : [];
  const guestsValue = openCheck ? openCheck.covers ?? 0 : draftGuests;

  function chooseTable(id) {
    setTableId(id);
    setDraft({});
    setNotes({});
    setNotice(null);
    setMoving(false);
    setTenderAmt("");
    const check = openCheckForTable(state.checks, id);
    setDraftGuests(check?.covers ?? 0);
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
      covers: guestsValue,
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

  function onGuests(raw) {
    const n = Number(raw);
    if (openCheck) {
      setCovers(openCheck.id, n);
      return;
    }
    setDraftGuests(n);
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
      const next = result.state.checks.find((c) => c.id === openCheck.id);
      setNotice(next?.status === "paid" ? `Paid · ${next.paidVia}` : `Tendered ${via}`);
    });
  }

  function reprint() {
    if (!openCheck) return;
    const receipt = (state.receipts ?? []).find((r) => r.id === openCheck.id) ?? makeReceipt(openCheck, venue);
    printReceipt(receipt);
  }

  return (
    <>
      <main className="till-workspace">
        {!ordering ? (
          <>
            <h1>Floor</h1>
            <FloorMap
              tables={records}
              state={state}
              selectedId={tableId}
              onSelect={chooseTable}
              childrenFor={(table) => (
                <ClaimActions
                  status={tableClaimStatus(state, table.id)}
                  onAccept={() => accept(table.id)}
                  onReject={() => reject(table.id)}
                />
              )}
            />
          </>
        ) : (
          <>
            <div className="till-strip">
              <button type="button" className="till-table till-table-sm" onClick={backToFloor}>
                Floor
              </button>
              {ids.map((id) => (
                <button
                  key={id}
                  type="button"
                  className={tableClass(tableId === id, tableClaimStatus(state, id), tableFloorStatus(state, id), true)}
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
              Guests
              <input type="number" min="0" max="99" value={guestsValue} onChange={(e) => onGuests(e.target.value)} />
            </label>
          </div>
        ) : null}
        {openCheck ? (
          <OfferPad
            venue={venue}
            check={openCheck}
            onAdd={(offer) => addCheckOffer(openCheck.id, offer)}
            onRemove={(id) => dropCheckOffer(openCheck.id, id)}
          />
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
            onPrint={reprint}
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
