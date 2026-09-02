import { useState } from "react";
import { stockCategories, stockOnHand, toBuy } from "../../services/pos";
import { usePos } from "./PosProvider";

export function StockView() {
  const {
    state,
    venue,
    addStockLine,
    patchStockLine,
    dropStockLine,
    countStock,
    receiveLine,
    orderStock,
    takeOrderLine,
  } = usePos();
  const [category, setCategory] = useState("all");
  const [name, setName] = useState("");
  const [unit, setUnit] = useState("bottle");
  const [par, setPar] = useState("12");
  const [cat, setCat] = useState("");
  const [notice, setNotice] = useState(null);
  const items = (venue.stockItems ?? []).filter((i) => category === "all" || i.category === category);
  const cats = stockCategories(venue);
  const buy = toBuy(state, venue);
  const openOrder = [...(state.stockOrders ?? [])].reverse().find((o) => o.status === "open") ?? null;

  function flash(result, okText) {
    if (!result.ok) {
      setNotice(result.error);
      return;
    }
    setNotice(okText);
  }

  return (
    <>
      <main className="till-workspace">
        <h1>Stock</h1>
        <p className="till-muted">
          Count what is on the shelf. Par is what you want to have. Buy is the gap. Turn this off in Settings if this venue does not count.
        </p>
        {cats.length ? (
          <div className="till-strip">
            <button type="button" className={category === "all" ? "till-table till-table-sm on" : "till-table till-table-sm"} onClick={() => setCategory("all")}>
              All
            </button>
            {cats.map((c) => (
              <button
                key={c}
                type="button"
                className={category === c ? "till-table till-table-sm on" : "till-table till-table-sm"}
                onClick={() => setCategory(c)}
              >
                {c}
              </button>
            ))}
          </div>
        ) : null}
        {items.length === 0 ? (
          <p className="till-empty">Nothing to count yet. Add soju, kimchi, napkins — whatever this kitchen actually tracks.</p>
        ) : (
          <ul className="till-stock-list">
            {items.map((item) => {
              const have = stockOnHand(state, item.id);
              const need = Math.max(0, item.par - have);
              return (
                <li key={item.id} className="till-stock-row">
                  <div>
                    <strong>{item.name}</strong>
                    <span>
                      {have} {item.unit} on hand
                      {item.par > 0 ? ` · par ${item.par}` : ""}
                      {need > 0 ? ` · buy ${need}` : ""}
                    </span>
                  </div>
                  <div className="till-stock-step">
                    <button type="button" className="till-ghost" onClick={() => countStock(item.id, Math.max(0, have - 1))} aria-label={`Less ${item.name}`}>
                      −
                    </button>
                    <input
                      type="number"
                      min="0"
                      step="0.5"
                      defaultValue={have}
                      key={`${item.id}-${have}`}
                      aria-label={`${item.name} on hand`}
                      onBlur={(e) => {
                        const n = Number(e.target.value);
                        if (!Number.isNaN(n) && n !== have) countStock(item.id, n);
                      }}
                    />
                    <button type="button" className="till-ghost" onClick={() => countStock(item.id, have + 1)} aria-label={`More ${item.name}`}>
                      +
                    </button>
                    <button
                      type="button"
                      className="till-ghost"
                      onClick={() => dropStockLine(item.id).then((r) => flash(r, "Removed"))}
                    >
                      Remove
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
        <h2>Add a line</h2>
        <div className="till-offer-add">
          <input placeholder="Soju" value={name} onChange={(e) => setName(e.target.value)} />
          <input placeholder="bottle" value={unit} onChange={(e) => setUnit(e.target.value)} aria-label="Unit" />
          <input type="number" min="0" step="0.5" value={par} onChange={(e) => setPar(e.target.value)} aria-label="Par" />
          <input placeholder="Bar (optional)" value={cat} onChange={(e) => setCat(e.target.value)} />
          <button
            type="button"
            className="till-ghost"
            onClick={() =>
              addStockLine({ name, unit, par: Number(par), category: cat }).then((r) => {
                flash(r, "Added");
                if (r.ok) {
                  setName("");
                  setCat("");
                }
              })
            }
          >
            Add
          </button>
        </div>
        {notice ? (
          <p className={/^(Added|Removed|Order|In)/.test(notice) ? "till-ok" : "till-error"}>{notice}</p>
        ) : null}
      </main>
      <aside className="till-book-pane">
        <h2>Buy</h2>
        {buy.length === 0 ? (
          <p className="till-muted">Nothing to buy. Count, or set a par on a line.</p>
        ) : (
          <ul className="till-diary">
            {buy.map((row) => (
              <li key={row.id} className="till-diary-card">
                <div>
                  <strong>
                    {row.need} {row.unit} {row.name}
                  </strong>
                  <span>
                    Have {row.have} · par {row.par}
                  </span>
                </div>
                <button type="button" className="till-ghost" onClick={() => receiveLine(row.id, row.need).then((r) => flash(r, "In"))}>
                  Just came in
                </button>
              </li>
            ))}
          </ul>
        )}
        <button type="button" className="till-primary" onClick={() => orderStock().then((r) => flash(r, "Order saved"))}>
          Save as an order
        </button>
        {openOrder ? (
          <>
            <h2>Open order</h2>
            <ul className="till-diary">
              {openOrder.lines.map((line) => {
                const left = Math.max(0, line.qty - (line.received || 0));
                return (
                  <li key={line.itemId} className="till-diary-card">
                    <div>
                      <strong>
                        {line.qty} {line.unit} {line.name}
                      </strong>
                      <span>{left ? `${line.received || 0} in · ${left} still out` : "All in"}</span>
                    </div>
                    {left ? (
                      <button type="button" className="till-ghost" onClick={() => takeOrderLine(openOrder.id, line.itemId).then((r) => flash(r, "In"))}>
                        Received
                      </button>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          </>
        ) : null}
      </aside>
    </>
  );
}
