import {
  amountDue,
  amountPaid,
  checkDiscount,
  checkNet,
  checkSubtotal,
  checkTotal,
  lineKey,
  money,
} from "../../services/pos";

export function CheckTotals({ check, venue }) {
  const sub = checkSubtotal(check);
  const discount = checkDiscount(check);
  const net = checkNet(check);
  const total = checkTotal(check, venue);
  const due = amountDue(check, venue);
  const paid = amountPaid(check) ?? (check.status === "paid" ? total : 0);
  const showDue = check.status !== "paid" && paid > 0;

  return (
    <div className="till-totals">
      <div>
        <span>Subtotal</span>
        <span>{money(sub)}</span>
      </div>
      {discount > 0 ? (
        <div>
          <span>Discount</span>
          <span>−{money(discount)}</span>
        </div>
      ) : null}
      {venue.gstEnabled ? (
        <div>
          <span>GST</span>
          <span>{money(net * venue.gstRate)}</span>
        </div>
      ) : null}
      {venue.surchargeEnabled ? (
        <div>
          <span>Surcharge</span>
          <span>{money(net * venue.surchargeRate)}</span>
        </div>
      ) : null}
      {paid > 0 && check.status !== "paid" ? (
        <div>
          <span>Paid</span>
          <span>{money(paid)}</span>
        </div>
      ) : null}
      <div className="till-grand">
        <span>{showDue ? "Due" : "Total"}</span>
        <span>{money(showDue ? due : total)}</span>
      </div>
    </div>
  );
}

export function PayPad({ due, amount, onAmount, onPay, disabled }) {
  return (
    <div className="till-pay">
      <label className="till-name">
        Tender{due != null ? ` · due ${money(due)}` : ""}
        <input
          type="number"
          min="0"
          step="0.01"
          placeholder={due != null ? String(due) : ""}
          value={amount}
          onChange={(e) => onAmount(e.target.value)}
        />
      </label>
      <div className="till-pay-pair">
        <button type="button" className="till-primary" disabled={disabled} onClick={() => onPay("card")}>
          Card
        </button>
        <button type="button" className="till-primary" disabled={disabled} onClick={() => onPay("cash")}>
          Cash
        </button>
      </div>
    </div>
  );
}

export function BillPanel({
  title,
  lines,
  venue,
  check,
  primaryLabel,
  onPrimary,
  primaryDisabled,
  extra,
  children,
}) {
  const bill = check ? { ...check, lines: lines.length ? lines : check.lines } : { lines, discountRate: 0, payments: [] };

  return (
    <aside className="till-context">
      <h2>{title}</h2>
      {extra}
      {lines.length === 0 ? (
        <p className="till-muted">No items yet</p>
      ) : (
        <ul className="till-lines">
          {lines.map((line) => (
            <li key={lineKey(line)}>
              <span>
                x{line.qty} {line.name}
                {line.note ? <em className="till-line-note"> — {line.note}</em> : null}
              </span>
              <span>{money(line.unitPrice * line.qty)}</span>
            </li>
          ))}
        </ul>
      )}
      <CheckTotals check={bill} venue={venue} />
      {children}
      {onPrimary ? (
        <button type="button" className="till-primary" onClick={onPrimary} disabled={primaryDisabled}>
          {primaryLabel}
        </button>
      ) : null}
    </aside>
  );
}
