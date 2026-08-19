export function MenuGrid({ menu, qtyByItem, onAdd, onRemove, disabled }) {
  return (
    <div className="till-menu">
      {menu.map((item) => {
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
          </div>
        );
      })}
    </div>
  );
}
