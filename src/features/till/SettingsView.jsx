import { usePos } from "./PosProvider";

export function SettingsView() {
  const { venue, setVenueTaxes } = usePos();

  function setPercent(field, raw) {
    const n = Number(raw);
    if (Number.isNaN(n)) return;
    setVenueTaxes({ [field]: n / 100 });
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
    </main>
  );
}
