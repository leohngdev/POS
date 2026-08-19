import { checkSubtotal, checkTotal, money } from "../../services/pos";

export function BillPanel({
  title,
  lines,
  venue,
  primaryLabel,
  onPrimary,
  primaryDisabled,
  extra,
  children,
}) {
  const fakeCheck = { lines };
  const sub = checkSubtotal(fakeCheck);
  const total = checkTotal(fakeCheck, venue);

  return (
    <aside className="till-context">
      <h2>{title}</h2>
      {extra}
      {lines.length === 0 ? (
        <p className="till-muted">No items yet</p>
      ) : (
        <ul className="till-lines">
          {lines.map((line) => (
            <li key={line.itemId}>
              x{line.qty} {line.name}
              <span>{money(line.unitPrice * line.qty)}</span>
            </li>
          ))}
        </ul>
      )}
      <div className="till-totals">
        <div>
          <span>Subtotal</span>
          <span>{money(sub)}</span>
        </div>
        {venue.gstEnabled ? (
          <div>
            <span>GST</span>
            <span>{money(sub * venue.gstRate)}</span>
          </div>
        ) : null}
        {venue.surchargeEnabled ? (
          <div>
            <span>Surcharge</span>
            <span>{money(sub * venue.surchargeRate)}</span>
          </div>
        ) : null}
        <div className="till-grand">
          <span>Total</span>
          <span>{money(total)}</span>
        </div>
      </div>
      {children}
      {onPrimary ? (
        <button type="button" className="till-primary" onClick={onPrimary} disabled={primaryDisabled}>
          {primaryLabel}
        </button>
      ) : null}
    </aside>
  );
}
