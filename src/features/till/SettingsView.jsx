import { useState } from "react";
import { DAYS, liveTables, money, nightReport } from "../../services/pos";
import { usePos } from "./PosProvider";
import { FloorMap } from "./FloorMap";
import { compressPhoto } from "./photo";

function isLoopbackHost(hostname) {
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]";
}

const TABS = [
  ["venue", "Venue"],
  ["floor", "Floor"],
  ["menu", "Menu"],
  ["offers", "Discounts"],
  ["tax", "Tax"],
  ["night", "Tonight"],
];

function MenuRow({ item, onPatch }) {
  const [name, setName] = useState(item.name);
  const [price, setPrice] = useState(String(item.unitPrice));

  return (
    <div className={`till-menu-row${item.soldOut ? " soldout" : ""}`}>
      <label className="till-photo-pick">
        {item.photo ? <img src={item.photo} alt="" /> : <span>Photo</span>}
        <input
          type="file"
          accept="image/*"
          hidden
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (!file) return;
            compressPhoto(file).then((photo) => onPatch(item.id, { photo }));
          }}
        />
      </label>
      <input
        value={name}
        aria-label={`${item.name} name`}
        onChange={(e) => setName(e.target.value)}
        onBlur={() => {
          if (name !== item.name) onPatch(item.id, { name });
        }}
      />
      <input
        type="number"
        min="0"
        step="0.5"
        value={price}
        aria-label={`${item.name} price`}
        onChange={(e) => setPrice(e.target.value)}
        onBlur={() => {
          const n = Number(price);
          if (!Number.isNaN(n) && n !== item.unitPrice) onPatch(item.id, { unitPrice: n });
        }}
      />
      <label className="till-86">
        <input
          type="checkbox"
          checked={Boolean(item.soldOut)}
          onChange={(e) => onPatch(item.id, { soldOut: e.target.checked })}
        />
        Hide
      </label>
    </div>
  );
}

export function SettingsView() {
  const {
    venue,
    state,
    setVenueTaxes,
    renameVenue,
    changePin,
    addFloorTable,
    removeFloorTable,
    moveFloorTable,
    addDish,
    patchDish,
    addVenueOffer,
    removeVenueOffer,
    closeNight,
    syncStatus,
  } = usePos();
  const [tab, setTab] = useState("venue");
  const [copied, setCopied] = useState(null);
  const [name, setName] = useState(venue.name);
  const [pin, setPin] = useState("");
  const [newTable, setNewTable] = useState("");
  const [newName, setNewName] = useState("");
  const [newPrice, setNewPrice] = useState("12");
  const [offerName, setOfferName] = useState("");
  const [offerKind, setOfferKind] = useState("percent");
  const [offerValue, setOfferValue] = useState("10");
  const [notice, setNotice] = useState(null);
  const report = nightReport(state);
  const firstTable = liveTables(venue)[0] ?? "01";
  const guestHome = `${window.location.origin}${window.location.pathname}#/order`;
  const guestTable = `${guestHome}/${firstTable}`;
  const loopback = isLoopbackHost(window.location.hostname);

  function setPercent(field, raw) {
    const n = Number(raw);
    if (Number.isNaN(n)) return;
    setVenueTaxes({ [field]: n / 100 });
  }

  function flash(result, okText) {
    if (!result.ok) {
      setNotice(result.error);
      return;
    }
    setNotice(okText);
  }

  async function copy(label, text) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(label);
    } catch {
      setCopied(null);
    }
  }

  return (
    <main className="till-workspace till-settings-page">
      <h1>Settings</h1>
      <p className="till-muted">
        This restaurant. Change what you use; leave the rest off.
        {syncStatus === "live" ? " Venue live." : " This device only until `npm run dev` or `npm start`."}
      </p>
      {notice ? (
        <p className={notice.startsWith("Saved") || notice.startsWith("Added") || notice.startsWith("Night") || notice.startsWith("Removed") ? "till-ok" : "till-error"}>
          {notice}
        </p>
      ) : null}
      <div className="till-strip">
        {TABS.map(([id, label]) => (
          <button key={id} type="button" className={tab === id ? "till-table till-table-sm on" : "till-table till-table-sm"} onClick={() => setTab(id)}>
            {label}
          </button>
        ))}
      </div>

      {tab === "venue" ? (
        <>
          <section className="till-settings till-settings-wide">
            <label className="till-setting">
              Restaurant name
              <input value={name} onChange={(e) => setName(e.target.value)} onBlur={() => name !== venue.name && renameVenue(name).then((r) => flash(r, "Saved name"))} />
            </label>
            <label className="till-setting">
              Staff PIN
              <input inputMode="numeric" placeholder="4–8 digits, blank keeps current" value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 8))} />
              <button type="button" className="till-ghost till-copy" disabled={pin.length < 4} onClick={() => changePin(pin).then((r) => { flash(r, "Saved PIN"); if (r.ok) setPin(""); })}>
                Save PIN
              </button>
              <span className="till-muted">A till PIN is a door code, not a login. Staff names come with rostering later. Lock the till when you walk away — or auto-lock below.</span>
            </label>
            <label className="till-setting">
              Auto-lock
              <select value={String(venue.lockMins)} onChange={(e) => setVenueTaxes({ lockMins: Number(e.target.value) })}>
                <option value="0">Off — lock yourself</option>
                <option value="5">After 5 minutes idle</option>
                <option value="10">After 10 minutes idle</option>
                <option value="30">After 30 minutes idle</option>
              </select>
            </label>
            <label className="till-setting">
              <input type="checkbox" checked={venue.askTakeawayPhone} onChange={(e) => setVenueTaxes({ askTakeawayPhone: e.target.checked })} />
              Ask for takeaway phone
            </label>
            <label className="till-setting">
              <input type="checkbox" checked={venue.askTakeawayEmail} onChange={(e) => setVenueTaxes({ askTakeawayEmail: e.target.checked })} />
              Ask for takeaway email
            </label>
          </section>
          <h2>Guest order</h2>
          <p className="till-muted">
            Phone and till on the same Wi‑Fi.
            {loopback ? " This tab is localhost — open the LAN address on this PC first." : " Copy a link onto the guest phone."}
          </p>
          <section className="till-settings">
            <label className="till-setting">
              Claim a table
              <code className="till-code">{guestHome}</code>
              <button type="button" className="till-ghost till-copy" onClick={() => copy("home", guestHome)}>
                {copied === "home" ? "Copied" : "Copy"}
              </button>
            </label>
            <label className="till-setting">
              Table {firstTable} shortcut
              <code className="till-code">{guestTable}</code>
              <button type="button" className="till-ghost till-copy" onClick={() => copy("table", guestTable)}>
                {copied === "table" ? "Copied" : "Copy"}
              </button>
            </label>
          </section>
        </>
      ) : null}

      {tab === "floor" ? (
        <>
          <p className="till-muted">Drag tables to match the room. Add 17 without adding 04. Remove a table if it is empty.</p>
          <FloorMap tables={venue.tables} editor onMove={(id, patch) => moveFloorTable(id, patch)} />
          <div className="till-floor-list">
            {venue.tables.map((t) => (
              <div key={t.id} className="till-menu-row">
                <strong>Table {t.id}</strong>
                <select value={t.shape} onChange={(e) => moveFloorTable(t.id, { shape: e.target.value })}>
                  <option value="square">Square</option>
                  <option value="round">Round</option>
                </select>
                <button type="button" className="till-ghost" onClick={() => removeFloorTable(t.id).then((r) => flash(r, `Removed ${t.id}`))}>
                  Remove
                </button>
              </div>
            ))}
          </div>
          <label className="till-name">
            Add table number
            <span className="till-add-table">
              <input value={newTable} onChange={(e) => setNewTable(e.target.value)} placeholder="05" inputMode="numeric" />
              <button
                type="button"
                className="till-ghost"
                onClick={() =>
                  addFloorTable(newTable).then((r) => {
                    flash(r, `Added ${r.ok ? r.state.venue.tables.at(-1).id : ""}`.trim());
                    if (r.ok) setNewTable("");
                  })
                }
              >
                Add
              </button>
            </span>
          </label>
        </>
      ) : null}

      {tab === "menu" ? (
        <>
          <p className="till-muted">Hide takes a dish off Send. Open checks keep the line. Photos stay on this till (keep them small).</p>
          <section className="till-menu-editor">
            {venue.menu.map((item) => (
              <MenuRow key={item.id} item={item} onPatch={patchDish} />
            ))}
            <div className="till-menu-row till-menu-add">
              <span />
              <input placeholder="New dish" value={newName} onChange={(e) => setNewName(e.target.value)} />
              <input type="number" min="0" step="0.5" value={newPrice} onChange={(e) => setNewPrice(e.target.value)} />
              <button
                type="button"
                className="till-ghost"
                onClick={() =>
                  addDish({ name: newName, unitPrice: Number(newPrice) }).then((r) => {
                    flash(r, "Added dish");
                    if (r.ok) {
                      setNewName("");
                      setNewPrice("12");
                    }
                  })
                }
              >
                Add
              </button>
            </div>
          </section>
        </>
      ) : null}

      {tab === "offers" ? (
        <>
          <p className="till-muted">Leave this empty if you do not use coupons. Floor only sees discounts you add here — percent or a dollar amount.</p>
          <ul className="till-offer-list">
            {venue.offers.length === 0 ? <li className="till-muted">No discounts set. Bills stay clean.</li> : null}
            {venue.offers.map((o) => (
              <li key={o.id}>
                <span>
                  {o.name} · {o.kind === "amount" ? money(o.value) : `${Math.round(o.value * 100)}%`}
                </span>
                <button type="button" className="till-ghost" onClick={() => removeVenueOffer(o.id).then((r) => flash(r, "Removed discount"))}>
                  Remove
                </button>
              </li>
            ))}
          </ul>
          <div className="till-offer-add">
            <input placeholder="Staff / Coupon" value={offerName} onChange={(e) => setOfferName(e.target.value)} />
            <select value={offerKind} onChange={(e) => setOfferKind(e.target.value)}>
              <option value="percent">Percent</option>
              <option value="amount">Dollars off</option>
            </select>
            <input type="number" min="0" step="0.5" value={offerValue} onChange={(e) => setOfferValue(e.target.value)} />
            <button
              type="button"
              className="till-ghost"
              onClick={() => {
                const value = offerKind === "amount" ? Number(offerValue) : Number(offerValue) / 100;
                addVenueOffer({ name: offerName, kind: offerKind, value }).then((r) => {
                  flash(r, "Added discount");
                  if (r.ok) {
                    setOfferName("");
                    setOfferValue("10");
                  }
                });
              }}
            >
              Add
            </button>
          </div>
        </>
      ) : null}

      {tab === "tax" ? (
        <section className="till-settings till-settings-wide">
          <label className="till-setting">
            <input type="checkbox" checked={venue.gstEnabled} onChange={(e) => setVenueTaxes({ gstEnabled: e.target.checked })} />
            GST
          </label>
          <label className="till-setting">
            GST %
            <input type="number" min="0" max="100" step="0.1" value={Math.round(venue.gstRate * 1000) / 10} onChange={(e) => setPercent("gstRate", e.target.value)} />
          </label>
          <label className="till-setting">
            <input type="checkbox" checked={venue.surchargeEnabled} onChange={(e) => setVenueTaxes({ surchargeEnabled: e.target.checked })} />
            Card surcharge
          </label>
          <p className="till-muted">Same every day, or set Saturday/Sunday higher. Today uses this device’s clock.</p>
          <div className="till-day-rates">
            {DAYS.map((label, i) => (
              <label key={label} className="till-setting">
                {label} %
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.1"
                  value={Math.round((venue.surchargeByDay?.[i] ?? venue.surchargeRate) * 1000) / 10}
                  onChange={(e) => {
                    const n = Number(e.target.value);
                    if (Number.isNaN(n)) return;
                    const next = [...(venue.surchargeByDay ?? DAYS.map(() => venue.surchargeRate))];
                    next[i] = n / 100;
                    setVenueTaxes({ surchargeByDay: next, surchargeRate: next[1] });
                  }}
                />
              </label>
            ))}
          </div>
        </section>
      ) : null}

      {tab === "night" ? (
        <>
          <p className="till-muted">Clears paid tickets, seated claims, and guest phones still pulsing. Open unpaid checks stay. Receipts stay in History.</p>
          <section className="till-night">
            <div>
              <span>Paid</span>
              <strong>{report.paidCount}</strong>
            </div>
            <div>
              <span>Open</span>
              <strong>{report.openCount}</strong>
            </div>
            <div>
              <span>Sales</span>
              <strong>{money(report.sales)}</strong>
            </div>
            <div>
              <span>Guests</span>
              <strong>{report.guests}</strong>
            </div>
            <div>
              <span>Card</span>
              <strong>{money(report.card)}</strong>
            </div>
            <div>
              <span>Cash</span>
              <strong>{money(report.cash)}</strong>
            </div>
            <div>
              <span>Split</span>
              <strong>{money(report.split)}</strong>
            </div>
            <div>
              <span>Dine in</span>
              <strong>
                {report.dineIn.count} · {money(report.dineIn.sales)}
              </strong>
            </div>
            <div>
              <span>Takeaway</span>
              <strong>
                {report.takeaway.count} · {money(report.takeaway.sales)}
              </strong>
            </div>
          </section>
          <button type="button" className="till-primary till-night-end" onClick={() => closeNight().then((r) => flash(r, "Night closed"))}>
            End of night
          </button>
        </>
      ) : null}
    </main>
  );
}
