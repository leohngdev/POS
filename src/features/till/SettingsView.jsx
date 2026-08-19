import { useState } from "react";
import { usePos } from "./PosProvider";

function isLoopbackHost(hostname) {
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]";
}

export function SettingsView() {
  const { venue, setVenueTaxes, syncStatus } = usePos();
  const [copied, setCopied] = useState(null);
  const guestHome = `${window.location.origin}${window.location.pathname}#/order`;
  const guestTable = `${guestHome}/04`;
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

  return (
    <main className="till-workspace">
      <h1>Settings</h1>
      <p className="till-muted">This venue only. Totals on the bill follow these flags. PIN stays 1234 in code this sprint.</p>
      <p className="till-muted">
        Sync: {syncStatus === "live" ? "venue live — phone and till share checks." : "this device only — start `npm run dev` so /api/snapshot is up."}
      </p>
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
      <h2>Guest order</h2>
      <p className="till-muted">
        Phone and till must open the same origin (this Vite host). `npm run dev` listens on the LAN.
        {loopback
          ? " This tab is localhost — a real phone cannot reach it. Open the till at this PC’s LAN address shown in the Vite terminal, then copy the link again."
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
          Table 04 shortcut
          <code className="till-code">{guestTable}</code>
          <button type="button" className="till-ghost till-copy" onClick={() => copy("table", guestTable)}>
            {copied === "table" ? "Copied" : "Copy"}
          </button>
        </label>
      </section>
    </main>
  );
}
