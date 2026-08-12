/** Disposable admin canvas — table + detail drawer. */
export function DemoShell({ section }) {
  const rows = [
    { id: "ORD-1042", name: "Table 4 · Dinner", status: "Open" },
    { id: "ORD-1043", name: "Counter · Takeaway", status: "Paid" },
    { id: "ORD-1044", name: "Table 12 · Lunch", status: "Open" },
  ];
  return (
    <>
      <main className="admin-main">
        <p className="canvas-eyebrow">Archetype · admin · {section}</p>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <h1 style={{ margin: 0, fontSize: 28 }}>Records</h1>
          <button className="canvas-btn" type="button">New record</button>
        </div>
        <div className="canvas-panel" style={{ padding: 8 }}>
          <table className="admin-table">
            <thead>
              <tr><th>ID</th><th>Name</th><th>Status</th></tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}><td>{r.id}</td><td>{r.name}</td><td>{r.status}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>
      <aside className="admin-detail">
        <p className="canvas-eyebrow">Detail drawer</p>
        <h2 style={{ marginTop: 0 }}>ORD-1042</h2>
        <p className="canvas-muted">Replace this panel with real record details. Filters stub lives under archetype/features.</p>
        <button className="canvas-btn ghost" type="button" style={{ marginTop: 12 }}>Edit</button>
      </aside>
    </>
  );
}
