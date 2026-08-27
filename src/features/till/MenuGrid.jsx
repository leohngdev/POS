import { orderableMenu } from "../../services/pos";

export function MenuGrid({ menu, qtyByItem, notesByItem, onAdd, onRemove, onNote, disabled }) {
  const items = orderableMenu(menu);

  return (
    <div className="till-menu">
      {items.length === 0 ? <p className="till-muted">Menu is empty or 86’d</p> : null}
      {items.map((item) => {
        const qty = qtyByItem[item.id] ?? 0;
        return (
          <div key={item.id} className="till-dish">
            <button type="button" className="till-dish-add" disabled={disabled} onClick={() => onAdd(item.id)}>
              <div className="till-photo" aria-hidden="true" />
              <div>{item.name}</div>
              <div className="till-dish-price">${item.unitPrice.toFixed(2)}</div>
            </button>
            <button
              type="button"
              className="till-qty"
              disabled={disabled || qty === 0}
              onClick={() => onRemove(item.id)}
              aria-label={`Remove one ${item.name}`}
            >
              −{qty ? ` x${qty}` : ""}
            </button>
            {qty > 0 && onNote ? (
              <input
                className="till-dish-note"
                placeholder="Kitchen note"
                value={notesByItem?.[item.id] ?? ""}
                onChange={(e) => onNote(item.id, e.target.value)}
                aria-label={`Note for ${item.name}`}
              />
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
