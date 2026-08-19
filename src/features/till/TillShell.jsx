import { useState } from "react";
import { DineInView } from "./DineInView";
import { TakeawayView } from "./TakeawayView";
import { TicketsView } from "./TicketsView";
import { KitchenView } from "./KitchenView";
import { SettingsView } from "./SettingsView";
import { usePos } from "./PosProvider";

const NAV = [
  { id: "dine-in", label: "Dine in" },
  { id: "takeaway", label: "Takeaway" },
  { id: "tickets", label: "Tickets" },
  { id: "kitchen", label: "Kitchen" },
  { id: "settings", label: "Settings" },
];

export function TillShell() {
  const [nav, setNav] = useState("dine-in");
  const { lock, syncStatus } = usePos();
  const wide = nav === "kitchen" || nav === "settings";

  return (
    <div className={`till-root till-shell${wide ? " till-shell-kitchen" : ""}`}>
      <aside className="till-nav">
        <div className="till-brand">TILL</div>
        <p className="till-sync">{syncStatus === "live" ? "Venue live" : "This device only"}</p>
        {NAV.map((item) => (
          <button
            key={item.id}
            type="button"
            className={nav === item.id ? "till-nav-item on" : "till-nav-item"}
            onClick={() => setNav(item.id)}
          >
            {item.label}
          </button>
        ))}
        <button type="button" className="till-ghost till-lock" onClick={lock}>
          Lock
        </button>
      </aside>
      {nav === "dine-in" ? <DineInView /> : null}
      {nav === "takeaway" ? <TakeawayView /> : null}
      {nav === "tickets" ? <TicketsView /> : null}
      {nav === "kitchen" ? <KitchenView /> : null}
      {nav === "settings" ? <SettingsView /> : null}
    </div>
  );
}
