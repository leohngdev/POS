import { useState } from "react";
import { isBoss, stockCategories, stockGrouped, stockOnHand, toBuy } from "../../services/pos";
import { usePos } from "./PosProvider";

function StockRow({ item, have, onCount, onRemove }) {
  const need = Math.max(0, item.par - have);
  return (
    <li className="till-stock-row">
      <div>
        <strong>{item.name}</strong>
        <span>
          {have} {item.unit} on hand
          {item.par > 0 ? ` · par ${item.par}` : ""}
          {need > 0 ? ` · buy ${need}` : ""}
        </span>
      </div>
      <div className="till-stock-step">
        <button type="button" className="till-ghost" onClick={() => onCount(Math.max(0, have - 1))} aria-label={`Less ${item.name}`}>
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
            if (!Number.isNaN(n) && n !== have) onCount(n);
          }}
        />
        <button type="button" className="till-ghost" onClick={() => onCount(have + 1)} aria-label={`More ${item.name}`}>
          +
        </button>
        {onRemove ? (
          <button type="button" className="till-ghost" onClick={onRemove}>
            Remove
          </button>
        ) : null}
      </div>
    </li>
  );
}

export function StockView() {
  const {
    state,
    venue,
    addStockLine,
    dropStockLine,
    countStock,
    receiveLine,
    orderStock,
    takeOrderLine,
    addShelf,
    dropShelf,
  } = usePos();
  const boss = isBoss(state.onStaff);
  const [filter, setFilter] = useState(null);
  const [name, setName] = useState("");
  const [unit, setUnit] = useState("bottle");
  const [par, setPar] = useState("12");
  const [cat, setCat] = useState("");
  const [shelf, setShelf] = useState("");
  const [notice, setNotice] = useState(null);
  const groups = venue.stockGroups ?? [];
  const cats = stockCategories(venue);
  const active = filter && (filter === "all" || cats.includes(filter)) ? filter : cats[0] ?? "all";
  const allItems = venue.stockItems ?? [];
  const items = active === "all" ? allItems : allItems.filter((i) => i.category === active);
  const sections = active === "all" ? stockGrouped(items) : [{ name: null, items }];
  const buy = toBuy(state, venue);
  const openOrder = [...(state.stockOrders ?? [])].reverse().find((o) => o.status === "open") ?? null;
  const addCat = cat || (active !== "all" ? active : "");

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
        <div className="till-page-head">
          <h1>Stock</h1>
        </div>
        <div className="till-strip">
          {cats.length ? (
            <button type="button" className={active === "all" ? "till-table till-table-sm on" : "till-table till-table-sm"} onClick={() => setFilter("all")}>
              All
            </button>
          ) : null}
        {groups.map((g) => (
          <button
            key={g.id}
            type="button"
            className={active === g.name ? "till-table till-table-sm on" : "till-table till-table-sm"}
            onClick={() => setFilter(g.name)}
          >
            {g.name}
          </button>
        ))}
        </div>
        {boss && active !== "all" && groups.some((g) => g.name === active) ? (
          <button
            type="button"
            className="till-ghost till-stock-unfile"
            onClick={() => {
              const group = groups.find((g) => g.name === active);
              if (!group) return;
              dropShelf(group.id).then((r) => {
                flash(r, "Shelf gone");
                if (r.ok) setFilter(null);
              });
            }}
          >
            Remove {active} shelf
          </button>
        ) : null}
        {boss ? (
        <div className="till-offer-add">
          <input placeholder="Bar, Fridge, Dry" value={shelf} onChange={(e) => setShelf(e.target.value)} />
          <button
            type="button"
            className="till-ghost"
            onClick={() =>
              addShelf(shelf).then((r) => {
                flash(r, "Shelf added");
                if (r.ok) {
                  setFilter(shelf.trim());
                  setShelf("");
                }
              })
            }
          >
            Add shelf
          </button>
        </div>
        ) : null}
        {items.length === 0 ? (
          <p className="till-empty">
            {active === "all"
              ? boss
                ? "Nothing to count yet. Add soju, kimchi, napkins — whatever this kitchen actually tracks."
                : "Nothing to count yet."
              : `Nothing on ${active} yet.${boss ? " Add a line, or pick another shelf." : ""}`}
          </p>
        ) : (
          sections.map((section) => (
            <div key={section.name ?? "list"} className="till-stock-section">
              {section.name ? <h2>{section.name}</h2> : null}
              <ul className="till-stock-list">
                {section.items.map((item) => (
                  <StockRow
                    key={item.id}
                    item={item}
                    have={stockOnHand(state, item.id)}
                    onCount={(qty) => countStock(item.id, qty)}
                    onRemove={boss ? () => dropStockLine(item.id).then((r) => flash(r, "Removed")) : null}
                  />
                ))}
              </ul>
            </div>
          ))
        )}
        {boss ? (
        <>
        <h2>Add a line</h2>
        <div className="till-offer-add">
          <input placeholder="Soju" value={name} onChange={(e) => setName(e.target.value)} />
          <input placeholder="bottle" value={unit} onChange={(e) => setUnit(e.target.value)} aria-label="Unit" />
          <input type="number" min="0" step="0.5" value={par} onChange={(e) => setPar(e.target.value)} aria-label="Par" />
          <select aria-label="Shelf" value={addCat} onChange={(e) => setCat(e.target.value)}>
            <option value="">Unfiled</option>
            {cats.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="till-ghost"
            onClick={() =>
              addStockLine({ name, unit, par: Number(par), category: addCat }).then((r) => {
                flash(r, "Added");
                if (r.ok) {
                  setName("");
                  if (addCat) setFilter(addCat);
                }
              })
            }
          >
            Add
          </button>
        </div>
        </>
        ) : null}
        {notice ? (
          <p className={/^(Added|Removed|Order|In|Shelf)/.test(notice) ? "till-ok" : "till-error"}>{notice}</p>
        ) : null}
      </main>
      <aside className="till-book-pane">
        {boss ? (
          <>
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
                    {row.category ? ` · ${row.category}` : ""}
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
          </>
        ) : (
          <>
            <h2>Count</h2>
            <p className="till-muted">Tap − / + for what’s on the shelf. Orders wait for whoever opened up with the till door.</p>
          </>
        )}
      </aside>
    </>
  );
}
