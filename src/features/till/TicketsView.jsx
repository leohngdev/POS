import { useState } from "react";
import {
  amountDue,
  canVoidLastSend,
  checkFloorStatus,
  checkLabel,
  checkTotal,
  money,
  liveTables,
  makeReceipt,
  moveTargets,
  openCheckForTable,
  pendingGuestTables,
  tableClaimStatus,
} from "../../services/pos";
import { usePos } from "./PosProvider";
import { BillPanel, PayPad } from "./BillPanel";
import { ClaimActions } from "./ClaimActions";
import { TableOps } from "./TableOps";
import { OfferPad } from "./OfferPad";
import { printReceipt } from "./Receipt";

function TicketCard({ title, detail, chip, selected, claimed, collapsed, paid, onSelect }) {
  return (
    <button
      type="button"
      className={`till-ticket${selected ? " on" : ""}${paid ? " paid" : ""}${collapsed ? " collapsed" : ""}${claimed ? " claimed" : ""}`}
      onClick={onSelect}
    >
      <strong>{title}</strong>
      <span>{detail}</span>
      {collapsed ? null : <span className="till-chip">{chip}</span>}
    </button>
  );
}

export function TicketsView() {
  const { state, venue, pay, accept, reject, move, voidSend, addCheckOffer, dropCheckOffer } = usePos();
  const [selectedId, setSelectedId] = useState(null);
  const [waitTable, setWaitTable] = useState(null);
  const [notice, setNotice] = useState(null);
  const [moving, setMoving] = useState(false);
  const [tenderAmt, setTenderAmt] = useState("");

  const waiting = pendingGuestTables(state, liveTables(venue));
  const waitingSet = new Set(waiting);
  const cooking = state.checks.filter((c) => {
    if (checkFloorStatus(c, state.chits) !== "cooking") return false;
    return !(c.channel === "dine-in" && waitingSet.has(c.tableId));
  });
  const ready = state.checks.filter((c) => {
    if (checkFloorStatus(c, state.chits) !== "ready") return false;
    return !(c.channel === "dine-in" && waitingSet.has(c.tableId));
  });
  const paid = state.checks.filter((c) => c.status === "paid");
  const selected = state.checks.find((c) => c.id === selectedId) ?? null;
  const selectedFloor = selected ? checkFloorStatus(selected, state.chits) : null;
  const claimTableId = selected?.channel === "dine-in" ? selected.tableId : waitTable;
  const claim = claimTableId ? tableClaimStatus(state, claimTableId) : null;
  const empty = state.checks.length === 0 && waiting.length === 0;

  async function settle(via) {
    if (!selected || selected.status === "paid") return;
    const amount = tenderAmt === "" ? undefined : Number(tenderAmt);
    const result = await pay(selected.id, via, amount);
    if (!result.ok) {
      setNotice(result.error);
      return;
    }
    setTenderAmt("");
    const next = result.state.checks.find((c) => c.id === selected.id);
    setNotice(next?.status === "paid" ? `Marked ${next.paidVia}` : `Tendered ${via}`);
  }

  function pickCheck(id) {
    setSelectedId(id);
    setWaitTable(null);
    setNotice(null);
    setMoving(false);
    setTenderAmt("");
  }

  function pickWait(tableId) {
    const check = openCheckForTable(state.checks, tableId);
    setSelectedId(check?.id ?? null);
    setWaitTable(tableId);
    setNotice(null);
    setMoving(false);
    setTenderAmt("");
  }

  return (
    <>
      <main className="till-workspace">
        {empty ? (
          <p className="till-empty">No open tickets</p>
        ) : (
          <>
            {waiting.length ? (
              <>
                <h2>Waiting</h2>
                <div className="till-ticket-row">
                  {waiting.map((id) => {
                    const check = openCheckForTable(state.checks, id);
                    return (
                      <TicketCard
                        key={id}
                        title={`Table ${id}`}
                        detail={check ? money(checkTotal(check, venue)) : "No order yet"}
                        chip="Guest"
                        selected={waitTable === id || selected?.tableId === id}
                        claimed
                        onSelect={() => pickWait(id)}
                      />
                    );
                  })}
                </div>
              </>
            ) : null}
            <h2>In progress</h2>
            <div className="till-ticket-row">
              {cooking.length === 0 ? <p className="till-muted">Kitchen is clear</p> : null}
              {cooking.map((check) => (
                <TicketCard
                  key={check.id}
                  title={checkLabel(check)}
                  detail={`${money(checkTotal(check, venue))}`}
                  chip="Cooking"
                  selected={selectedId === check.id && !waitTable}
                  claimed={tableClaimStatus(state, check.tableId) === "pending"}
                  onSelect={() => pickCheck(check.id)}
                />
              ))}
            </div>
            <h2>To pay</h2>
            <div className="till-ticket-row">
              {ready.length === 0 ? <p className="till-muted">Nothing waiting on payment</p> : null}
              {ready.map((check) => (
                <TicketCard
                  key={check.id}
                  title={checkLabel(check)}
                  detail={money(checkTotal(check, venue))}
                  chip="Pay now"
                  selected={selectedId === check.id && !waitTable}
                  claimed={tableClaimStatus(state, check.tableId) === "pending"}
                  onSelect={() => pickCheck(check.id)}
                />
              ))}
            </div>
            <h2>Paid</h2>
            <div className="till-ticket-row">
              {paid.length === 0 ? <p className="till-muted">None yet</p> : null}
              {paid.map((check) => (
                <TicketCard
                  key={check.id}
                  title={checkLabel(check)}
                  detail={`${check.paidVia} · ${money(checkTotal(check, venue))}`}
                  chip="Paid"
                  selected={selectedId === check.id && !waitTable}
                  paid
                  collapsed={!selected || selectedId !== check.id || Boolean(waitTable)}
                  onSelect={() => pickCheck(check.id)}
                />
              ))}
            </div>
          </>
        )}
      </main>
      {selected || waitTable ? (
        <BillPanel
          title={selected ? checkLabel(selected) : `Table ${waitTable}`}
          lines={selected?.lines ?? []}
          venue={venue}
          check={selected}
          extra={
            <p className="till-muted">
              {claim === "pending"
                ? "Guest claimed this table. Accept to seat them, or Reject to kick them off."
                : selectedFloor === "paid"
                  ? `Paid · ${selected.paidVia}`
                  : selectedFloor === "cooking"
                    ? "Kitchen still has a chit"
                    : selected
                      ? "Ready to pay"
                      : "No order yet"}
            </p>
          }
        >
          <ClaimActions
            status={claim}
            onAccept={() => accept(claimTableId)}
            onReject={() => {
              reject(claimTableId);
              setWaitTable(null);
            }}
          />
          <TableOps
            showMove={Boolean(claimTableId && (selected?.channel === "dine-in" || waitTable) && selected?.status !== "paid")}
            targets={claimTableId ? moveTargets(state, liveTables(venue), claimTableId) : []}
            moving={moving}
            onToggleMove={() => setMoving((m) => !m)}
            onMoveTo={(id) => {
              move(claimTableId, id).then((result) => {
                if (!result.ok) {
                  setNotice(result.error);
                  return;
                }
                setWaitTable(waitTable ? id : null);
                setMoving(false);
                setNotice(`Moved to ${id}`);
              });
            }}
            canVoid={selected ? canVoidLastSend(state, selected.id) : false}
            onVoid={
              selected?.status === "open"
                ? () => {
                    voidSend(selected.id).then((result) => {
                      if (!result.ok) {
                        setNotice(result.error);
                        return;
                      }
                      if (!result.state.checks.some((c) => c.id === selected.id)) {
                        setSelectedId(null);
                      }
                      setNotice("Voided last Send");
                    });
                  }
                : undefined
            }
          />
          {notice ? (
            <p
              className={
                notice.startsWith("Marked") ||
                notice.startsWith("Moved") ||
                notice.startsWith("Voided") ||
                notice.startsWith("Tendered")
                  ? "till-ok"
                  : "till-error"
              }
            >
              {notice}
            </p>
          ) : null}
          {selected?.status === "open" ? (
            <>
              <OfferPad
                venue={venue}
                check={selected}
                onAdd={(offer) => addCheckOffer(selected.id, offer)}
                onRemove={(id) => dropCheckOffer(selected.id, id)}
              />
              <PayPad
                due={amountDue(selected, venue)}
                amount={tenderAmt}
                onAmount={setTenderAmt}
                onPay={settle}
                onPrint={() => printReceipt(makeReceipt(selected, venue))}
              />
            </>
          ) : selected?.status === "paid" ? (
            <button
              type="button"
              className="till-ghost till-inline"
              onClick={() =>
                printReceipt((state.receipts ?? []).find((r) => r.id === selected.id) ?? makeReceipt(selected, venue))
              }
            >
              Print receipt
            </button>
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
