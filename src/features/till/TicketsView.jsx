import { useState } from "react";
import {
  canVoidLastSend,
  checkFloorStatus,
  checkLabel,
  checkTotal,
  money,
  moveTargets,
  openCheckForTable,
  pendingGuestTables,
  tableClaimStatus,
} from "../../services/pos";
import { usePos } from "./PosProvider";
import { BillPanel } from "./BillPanel";
import { ClaimActions } from "./ClaimActions";
import { TableOps } from "./TableOps";

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
  const { state, venue, pay, accept, reject, move, voidSend } = usePos();
  const [selectedId, setSelectedId] = useState(null);
  const [waitTable, setWaitTable] = useState(null);
  const [notice, setNotice] = useState(null);
  const [moving, setMoving] = useState(false);

  const waiting = pendingGuestTables(state, venue.tables);
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
    const result = await pay(selected.id, via);
    if (!result.ok) {
      setNotice(result.error);
      return;
    }
    setNotice(`Marked ${via}`);
  }

  function pickCheck(id) {
    setSelectedId(id);
    setWaitTable(null);
    setNotice(null);
    setMoving(false);
  }

  function pickWait(tableId) {
    const check = openCheckForTable(state.checks, tableId);
    setSelectedId(check?.id ?? null);
    setWaitTable(tableId);
    setNotice(null);
    setMoving(false);
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
            targets={claimTableId ? moveTargets(state, venue.tables, claimTableId) : []}
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
          {notice ? <p className={notice.startsWith("Marked") || notice.startsWith("Moved") || notice.startsWith("Voided") ? "till-ok" : "till-error"}>{notice}</p> : null}
          {selected?.status === "open" ? (
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
