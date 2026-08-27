import { checkOffers, money } from "../../services/pos";

export function OfferPad({ venue, check, onAdd, onRemove }) {
  const catalog = venue.offers ?? [];
  if (!catalog.length && !checkOffers(check).length) return null;
  const applied = new Set(checkOffers(check).map((o) => o.id));

  return (
    <div className="till-offers">
      <p className="till-muted">Discounts</p>
      {checkOffers(check).map((offer) => (
        <button key={offer.id} type="button" className="till-ghost till-inline" onClick={() => onRemove(offer.id)}>
          {offer.name} · {offer.kind === "amount" ? money(offer.value) : `${Math.round(offer.value * 100)}%`} · Remove
        </button>
      ))}
      {catalog
        .filter((o) => !applied.has(o.id))
        .map((offer) => (
          <button key={offer.id} type="button" className="till-table till-table-sm" onClick={() => onAdd(offer)}>
            {offer.name}
          </button>
        ))}
    </div>
  );
}
