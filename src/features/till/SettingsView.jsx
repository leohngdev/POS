import { useState } from "react";
import { money, nightReport } from "../../services/pos";
import { usePos } from "./PosProvider";

function MenuRow({ item, onPatch }) {
  const [name, setName] = useState(item.name);
  const [price, setPrice] = useState(String(item.unitPrice));

  return (
    <div className={`till-menu-row${item.soldOut ? " soldout" : ""}`}>
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
        86
      </label>
    </div>
  );
}

function isLoopbackHost(hostname) {
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]";
}

export function SettingsView() {
  const {
    venue,
    state,
    setVenueTaxes,
    renameVenue,
    changePin,
    changeTableCount,
    addDish,
    patchDish,
    closeNight,
    syncStatus,
  } = usePos();
  const [copied, setCopied] = useState(null);
  const [name, setName] = useState(venue.name);
  const [pin, setPin] = useState("");
  const [tables, setTables] = useState(String(venue.tables.length));
  const [newName, setNewName] = useState("");
  const [newPrice, setNewPrice] = useState("12");
  const [notice, setNotice] = useState(null);
  const report = nightReport(state);
  const firstTable = venue.tables[0] ?? "01";
  const guestHome = `${window.location.origin}${window.location.pathname}#/order`;
  const guestTable = `${guestHome}/${firstTable}`;
  const loopback = isLoopbackHost(window.location.hostname);

  function setPercent(field, raw) {
    const n = Number(raw);
    if (Number.isNaN(n)) return;
    setVenueTaxes({ [field]: n / 100 });
  }

  async function copy(label, text) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(label);
    } catch {
      setCopied(null);
    }
  }

  function flash(result, okText) {
    if (!result.ok) {
      setNotice(result.error);
      return;
    }
    setNotice(okText);
  }

  return (
    <main className="till-workspace till-settings-page">
      <h1>Settings</h1>
      <p className="till-muted">
        This venue only. Menu, floor, PIN, and tax live in the snapshot — every till on the LAN shares them.
        Sync: {syncStatus === "live" ? "venue live." : "this device only — run `npm run dev` or `npm start` so /api/snapshot is up."}
      </p>
      {notice ? (
        <p className={notice.startsWith("Saved") || notice.startsWith("Added") || notice.startsWith("Night") ? "till-ok" : "till-error"}>
          {notice}
        </p>
      ) : null}

      <h2>Venue</h2>
      <section className="till-settings till-settings-wide">
        <label className="till-setting">
          Name
          <input value={name} onChange={(e) => setName(e.target.value)} onBlur={() => name !== venue.name && renameVenue(name).then((r) => flash(r, "Saved name"))} />
        </label>
        <label className="till-setting">
          Staff PIN (4–8 digits)
          <input
            inputMode="numeric"
            placeholder="leave blank to keep current"
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 8))}
          />
          <button
            type="button"
            className="till-ghost till-copy"
            disabled={pin.length < 4}
            onClick={() =>
              changePin(pin).then((r) => {
                flash(r, "Saved PIN");
                if (r.ok) setPin("");
              })
            }
          >
            Save PIN
          </button>
        </label>
        <label className="till-setting">
          Tables on the floor
          <input
            type="number"
            min="1"
            max="40"
            value={tables}
            onChange={(e) => setTables(e.target.value)}
          />
          <button
            type="button"
            className="till-ghost till-copy"
            onClick={() =>
              changeTableCount(Number(tables)).then((r) => {
                flash(r, `Saved ${r.ok ? r.state.venue.tables.length : ""} tables`.trim());
              })
            }
          >
            Save tables
          </button>
        </label>
      </section>

      <h2>Menu</h2>
      <p className="till-muted">86 hides a dish from Send. Open checks keep the line. Price edits apply to the next Send, not food already on a check.</p>
      <section className="till-menu-editor">
        {venue.menu.map((item) => (
          <MenuRow key={item.id} item={item} onPatch={patchDish} />
        ))}
        <div className="till-menu-row till-menu-add">
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

      <h2>Tax</h2>
      <section className="till-settings">
        <label className="till-setting">
          <input
            type="checkbox"
            checked={venue.gstEnabled}
            onChange={(e) => setVenueTaxes({ gstEnabled: e.target.checked })}
          />
          GST
        </label>
        <label className="till-setting">
          GST %
          <input
            type="number"
            min="0"
            max="100"
            step="0.1"
            value={Math.round(venue.gstRate * 1000) / 10}
            onChange={(e) => setPercent("gstRate", e.target.value)}
          />
        </label>
        <label className="till-setting">
          <input
            type="checkbox"
            checked={venue.surchargeEnabled}
            onChange={(e) => setVenueTaxes({ surchargeEnabled: e.target.checked })}
          />
          Surcharge
        </label>
        <label className="till-setting">
          Surcharge %
          <input
            type="number"
            min="0"
            max="100"
            step="0.1"
            value={Math.round(venue.surchargeRate * 1000) / 10}
            onChange={(e) => setPercent("surchargeRate", e.target.value)}
          />
        </label>
      </section>

      <h2>Tonight</h2>
      <p className="till-muted">Paid tickets only. Open checks and kitchen chits stay. End of night does not lock the till.</p>
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
          <span>Covers</span>
          <strong>{report.covers}</strong>
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
      <button
        type="button"
        className="till-primary till-night-end"
        disabled={report.paidCount === 0}
        onClick={() => closeNight().then((r) => flash(r, "Night closed — paid tickets cleared"))}
      >
        End of night
      </button>

      <h2>Guest order</h2>
      <p className="till-muted">
        Phone and till must open the same origin. For a service night: `npm run build && npm start` (LAN, port 4173). For coding: `npm run dev`.
        Claimed tables pulse on Dine in and Tickets until the floor Accepts. Reject still voids unpaid guest tickets.
        {loopback
          ? " This tab is localhost — a real phone cannot reach it. Open the till at this PC’s LAN address, then copy the link again."
          : " Copy a link below onto the guest phone on the same Wi‑Fi."}
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
    </main>
  );
}
