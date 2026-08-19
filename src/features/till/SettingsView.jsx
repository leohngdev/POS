import { useState } from "react";
import { usePos } from "./PosProvider";

export function SettingsView() {
  const { venue, setVenueTaxes } = usePos();
  const [copied, setCopied] = useState(null);
  const guestHome = `${window.location.origin}${window.location.pathname}#/order`;
  const guestTable = `${guestHome}/04`;

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
        Same origin as this till. Open the link on a second tab (or a phone on the same computer) to dogfood.
        A real phone vs iPad will not share this store until there is a server.
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
