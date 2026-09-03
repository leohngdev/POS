import { useState } from "react";
import { DAYS, liveTables, liveZones, money, nightReport } from "../../services/pos";
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
    renameFloorTable,
    addFloorZone,
    renameFloorZone,
    removeFloorZone,
    reorderFloorTable,
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
  const [newZone, setNewZone] = useState("");
  const [tableZone, setTableZone] = useState("");
  const [afterTable, setAfterTable] = useState("");
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
  const clockHome = `${window.location.origin}${window.location.pathname}#/clock`;
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
      <div className="till-page-head">
        <h1>Settings</h1>
        <p className="till-muted">{syncStatus === "live" ? "Venue live" : "This device only"}</p>
      </div>
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
          <section className="till-compact">
            <label className="till-setting">
              Restaurant name
              <input value={name} onChange={(e) => setName(e.target.value)} onBlur={() => name !== venue.name && renameVenue(name).then((r) => flash(r, "Saved name"))} />
            </label>
            <label className="till-setting">
              Till door PIN
              <span className="till-add-table">
                <input inputMode="numeric" placeholder="4–8 digits" value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 8))} />
                <button type="button" className="till-ghost till-copy" disabled={pin.length < 4} onClick={() => changePin(pin).then((r) => { flash(r, "Saved PIN"); if (r.ok) setPin(""); })}>
                  Save
                </button>
              </span>
            </label>
            <label className="till-setting">
              Auto-lock
              <select value={String(venue.lockMins)} onChange={(e) => setVenueTaxes({ lockMins: Number(e.target.value) })}>
                <option value="0">Off</option>
                <option value="5">5 minutes</option>
                <option value="10">10 minutes</option>
                <option value="30">30 minutes</option>
              </select>
            </label>
            {venue.useBookings !== false ? (
              <label className="till-setting">
                Hold tables
                <select value={String(venue.bookingMins ?? 90)} onChange={(e) => setVenueTaxes({ bookingMins: Number(e.target.value) })}>
                  <option value="60">60 minutes</option>
                  <option value="90">90 minutes</option>
                  <option value="120">2 hours</option>
                  <option value="150">2.5 hours</option>
                </select>
              </label>
            ) : null}
          </section>
          <div className="till-flags">
            <label>
              <input type="checkbox" checked={venue.useBookings !== false} onChange={(e) => setVenueTaxes({ useBookings: e.target.checked })} />
              Bookings
            </label>
            <label>
              <input type="checkbox" checked={venue.useStock !== false} onChange={(e) => setVenueTaxes({ useStock: e.target.checked })} />
              Stock
            </label>
            <label>
              <input type="checkbox" checked={venue.useRoster !== false} onChange={(e) => setVenueTaxes({ useRoster: e.target.checked })} />
              Roster
            </label>
            <label>
              <input type="checkbox" checked={venue.askTakeawayPhone} onChange={(e) => setVenueTaxes({ askTakeawayPhone: e.target.checked })} />
              Takeaway phone
            </label>
            <label>
              <input type="checkbox" checked={venue.askTakeawayEmail} onChange={(e) => setVenueTaxes({ askTakeawayEmail: e.target.checked })} />
              Takeaway email
            </label>
          </div>
          <div className="till-links">
            <label className="till-setting">
              Guest order
              <span className="till-add-table">
                <code className="till-code">{guestHome}</code>
                <button type="button" className="till-ghost till-copy" onClick={() => copy("home", guestHome)}>
                  {copied === "home" ? "Copied" : "Copy"}
                </button>
              </span>
            </label>
            <label className="till-setting">
              Table {firstTable}
              <span className="till-add-table">
                <code className="till-code">{guestTable}</code>
                <button type="button" className="till-ghost till-copy" onClick={() => copy("table", guestTable)}>
                  {copied === "table" ? "Copied" : "Copy"}
                </button>
              </span>
            </label>
            {venue.useRoster !== false ? (
              <label className="till-setting">
                Staff clock
                <span className="till-add-table">
                  <code className="till-code">{clockHome}</code>
                  <button type="button" className="till-ghost till-copy" onClick={() => copy("clock", clockHome)}>
                    {copied === "clock" ? "Copied" : "Copy"}
                  </button>
                </span>
              </label>
            ) : null}
          </div>
          {loopback ? <p className="till-muted">Phones need this PC’s LAN address, not localhost.</p> : null}
        </>
      ) : null}

      {tab === "floor" ? (
        <>
          <p className="till-muted">Drag the tables on the map like the room. Drag a row to change the strip order.</p>
          {liveZones(venue).length > 1 ? (
            <div className="till-strip">
              {liveZones(venue).map((z) => (
                <span key={z.id} className="till-zone-edit">
                  <input
                    defaultValue={z.name}
                    aria-label={`${z.name} area name`}
                    onBlur={(e) => {
                      if (e.target.value !== z.name) renameFloorZone(z.id, e.target.value).then((r) => flash(r, "Saved area"));
                    }}
                  />
                  <button type="button" className="till-ghost" onClick={() => removeFloorZone(z.id).then((r) => flash(r, "Removed area"))}>
                    Remove
                  </button>
                </span>
              ))}
            </div>
          ) : null}
          <label className="till-name">
            Add an area
            <span className="till-add-table">
              <input value={newZone} onChange={(e) => setNewZone(e.target.value)} placeholder="Upstairs" />
              <button
                type="button"
                className="till-ghost"
                onClick={() =>
                  addFloorZone(newZone).then((r) => {
                    flash(r, "Added area");
                    if (r.ok) setNewZone("");
                  })
                }
              >
                Add
              </button>
            </span>
          </label>
          <FloorMap tables={venue.tables} editor onMove={(id, patch) => moveFloorTable(id, patch)} />
          <div className="till-floor-list">
            {venue.tables.map((t) => (
              <div
                key={t.id}
                className="till-menu-row till-table-edit"
                data-table-row={t.id}
              >
                <button
                  type="button"
                  className="till-drag"
                  aria-label={`Move ${t.id} in the list`}
                  onPointerDown={(event) => {
                    event.preventDefault();
                    const fromId = t.id;
                    function up(ev) {
                      window.removeEventListener("pointerup", up);
                      const hit = document.elementFromPoint(ev.clientX, ev.clientY);
                      const row = hit?.closest("[data-table-row]");
                      const toId = row?.getAttribute("data-table-row");
                      if (!toId || toId === fromId) return;
                      const toIndex = venue.tables.findIndex((x) => x.id === toId);
                      if (toIndex >= 0) reorderFloorTable(fromId, toIndex);
                    }
                    window.addEventListener("pointerup", up);
                  }}
                >
                  ≡
                </button>
                <input
                  defaultValue={t.id}
                  aria-label={`Rename table ${t.id}`}
                  onBlur={(e) => {
                    if (e.target.value !== t.id) renameFloorTable(t.id, e.target.value).then((r) => flash(r, "Saved table"));
                  }}
                />
                <select value={t.shape} onChange={(e) => moveFloorTable(t.id, { shape: e.target.value })}>
                  <option value="square">Square</option>
                  <option value="round">Round</option>
                </select>
                {liveZones(venue).length > 1 ? (
                  <select value={t.zoneId} onChange={(e) => moveFloorTable(t.id, { zoneId: e.target.value })}>
                    {liveZones(venue).map((z) => (
                      <option key={z.id} value={z.id}>
                        {z.name}
                      </option>
                    ))}
                  </select>
                ) : null}
                <input
                  type="number"
                  min="1"
                  max="20"
                  defaultValue={t.seats}
                  aria-label={`${t.id} seats`}
                  onBlur={(e) => {
                    const n = Number(e.target.value);
                    if (n && n !== t.seats) moveFloorTable(t.id, { seats: n });
                  }}
                />
                <button type="button" className="till-ghost" onClick={() => removeFloorTable(t.id).then((r) => flash(r, `Removed ${t.id}`))}>
                  Remove
                </button>
              </div>
            ))}
          </div>
          <label className="till-name">
            Add a table
            <span className="till-add-table">
              <input value={newTable} onChange={(e) => setNewTable(e.target.value)} placeholder="1a" />
              {liveZones(venue).length > 1 ? (
                <select value={tableZone || liveZones(venue)[0].id} onChange={(e) => setTableZone(e.target.value)}>
                  {liveZones(venue).map((z) => (
                    <option key={z.id} value={z.id}>
                      {z.name}
                    </option>
                  ))}
                </select>
              ) : null}
              <select value={afterTable} onChange={(e) => setAfterTable(e.target.value)} aria-label="Place after">
                <option value="">At the end</option>
                {venue.tables.map((t) => (
                  <option key={t.id} value={t.id}>
                    After {t.id}
                  </option>
                ))}
              </select>
              <button
                type="button"
                className="till-ghost"
                onClick={() =>
                  addFloorTable(newTable, tableZone || liveZones(venue)[0]?.id, afterTable || undefined).then((r) => {
                    flash(r, r.ok ? `Added ${newTable}` : r.error);
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
