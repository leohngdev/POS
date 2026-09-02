import { useState } from "react";
import { DineInView } from "./DineInView";
import { BookView } from "./BookView";
import { StockView } from "./StockView";
import { TakeawayView } from "./TakeawayView";
import { TicketsView } from "./TicketsView";
import { KitchenView } from "./KitchenView";
import { SettingsView } from "./SettingsView";
import { HistoryView } from "./HistoryView";
import { usePos } from "./PosProvider";
import { hasPendingGuestClaims } from "../../services/pos";

const NAV = [
  { id: "dine-in", label: "Dine in" },
  { id: "book", label: "Book", book: true },
  { id: "takeaway", label: "Takeaway" },
  { id: "tickets", label: "Tickets" },
  { id: "kitchen", label: "Kitchen" },
  { id: "stock", label: "Stock" },
  { id: "history", label: "History" },
  { id: "settings", label: "Settings" },
];

export function TillShell() {
  const [nav, setNav] = useState("dine-in");
  const { lock, syncStatus, state, venue } = usePos();
  const guestWaiting = hasPendingGuestClaims(state);
  const items = NAV.filter((item) => {
    if (item.id === "book" && venue.useBookings === false) return false;
    if (item.id === "stock" && venue.useStock === false) return false;
    return true;
  });
  const current = items.some((item) => item.id === nav) ? nav : "dine-in";
  const wide = current === "kitchen" || current === "settings";

  return (
    <div className={`till-root till-shell${wide ? " till-shell-kitchen" : ""}`}>
      <aside className="till-nav">
        <div className="till-brand">{venue.name || "TILL"}</div>
        <p className="till-sync">{syncStatus === "live" ? "Venue live" : "This device only"}</p>
        {items.map((item) => (
          <button
            key={item.id}
            type="button"
            className={`${current === item.id ? "till-nav-item on" : "till-nav-item"}${
              guestWaiting && (item.id === "dine-in" || item.id === "tickets") ? " alert" : ""
            }`}
            onClick={() => setNav(item.id)}
          >
            {item.label}
          </button>
        ))}
        <button type="button" className="till-ghost till-lock" onClick={lock}>
          Lock
        </button>
      </aside>
      {current === "dine-in" ? <DineInView /> : null}
      {current === "book" ? <BookView /> : null}
      {current === "takeaway" ? <TakeawayView /> : null}
      {current === "tickets" ? <TicketsView /> : null}
      {current === "kitchen" ? <KitchenView /> : null}
      {current === "stock" ? <StockView /> : null}
      {current === "history" ? <HistoryView /> : null}
      {current === "settings" ? <SettingsView /> : null}
    </div>
  );
}
