import { checkOffers, lineKey, money } from "../../services/pos";

export function ReceiptBody({ receipt }) {
  return (
    <article className="till-receipt">
      <p className="till-eyebrow">{receipt.venueName || "Receipt"}</p>
      <h2>{receipt.channel === "takeaway" ? receipt.queueNumber : `Table ${receipt.tableId}`}</h2>
      {receipt.guestName ? <p>{receipt.guestName}</p> : null}
      {receipt.guestPhone ? <p>{receipt.guestPhone}</p> : null}
      {receipt.guestEmail ? <p>{receipt.guestEmail}</p> : null}
      {receipt.guests ? <p>{receipt.guests} guests</p> : null}
      <p className="till-muted">{receipt.at ? new Date(receipt.at).toLocaleString() : ""}</p>
      <ul className="till-lines">
        {(receipt.lines ?? []).map((line) => (
          <li key={lineKey(line)}>
            <span>
              x{line.qty} {line.name}
              {line.note ? <em className="till-line-note"> — {line.note}</em> : null}
            </span>
            <span>{money(line.unitPrice * line.qty)}</span>
          </li>
        ))}
      </ul>
      {checkOffers(receipt).map((offer) => (
        <p key={offer.id} className="till-muted">
          {offer.name}
        </p>
      ))}
      {receipt.discount > 0 ? (
        <p>
          Discount <span>{money(receipt.discount)}</span>
        </p>
      ) : null}
      <p className="till-grand">
        Total <span>{money(receipt.total)}</span>
      </p>
      <p className="till-muted">
        {(receipt.paidVia || "paid").toString()}
        {receipt.payments?.length
          ? ` · ${receipt.payments.map((p) => `${p.via} ${money(p.amount)}`).join(", ")}`
          : ""}
      </p>
    </article>
  );
}

export function printReceipt(receipt) {
  const host = document.getElementById("till-print-root");
  if (!host || !receipt) {
    window.print();
    return;
  }
  host.replaceChildren();
  const wrap = document.createElement("div");
  wrap.className = "till-print-sheet";
  const title = document.createElement("h1");
  title.textContent = receipt.venueName || "Receipt";
  wrap.appendChild(title);
  const ident = document.createElement("p");
  ident.textContent =
    receipt.channel === "takeaway" ? receipt.queueNumber || "Takeaway" : `Table ${receipt.tableId}`;
  wrap.appendChild(ident);
  if (receipt.guestName) {
    const n = document.createElement("p");
    n.textContent = receipt.guestName;
    wrap.appendChild(n);
  }
  const when = document.createElement("p");
  when.textContent = receipt.at ? new Date(receipt.at).toLocaleString() : "";
  wrap.appendChild(when);
  const ul = document.createElement("ul");
  for (const line of receipt.lines ?? []) {
    const li = document.createElement("li");
    li.textContent = `x${line.qty} ${line.name}${line.note ? ` — ${line.note}` : ""}    $${Number(line.unitPrice * line.qty).toFixed(2)}`;
    ul.appendChild(li);
  }
  wrap.appendChild(ul);
  const total = document.createElement("p");
  total.style.fontWeight = "800";
  total.textContent = `Total $${Number(receipt.total).toFixed(2)}`;
  wrap.appendChild(total);
  const via = document.createElement("p");
  via.textContent = receipt.paidVia || "paid";
  wrap.appendChild(via);
  host.appendChild(wrap);
  document.body.classList.add("till-printing");
  window.print();
  document.body.classList.remove("till-printing");
}
