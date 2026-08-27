import { useMemo, useState } from "react";
import { compactLines, nextQueueNumber } from "../../services/pos";
import { usePos } from "./PosProvider";
import { MenuGrid } from "./MenuGrid";
import { BillPanel } from "./BillPanel";

function bumpQty(map, id, delta) {
  const next = { ...map, [id]: Math.max(0, (map[id] ?? 0) + delta) };
  if (next[id] === 0) delete next[id];
  return next;
}

export function TakeawayView() {
  const { state, venue, sendOrder } = usePos();
  const [draft, setDraft] = useState({});
  const [notes, setNotes] = useState({});
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [notice, setNotice] = useState(null);
  const queueNumber = nextQueueNumber(state.nextTakeaway);
  const lines = useMemo(() => compactLines(draft, venue.menu, notes), [draft, venue.menu, notes]);

  async function send() {
    const result = await sendOrder({
      channel: "takeaway",
      tableId: null,
      queueNumber,
      guestName: name,
      guestPhone: venue.askTakeawayPhone ? phone : undefined,
      guestEmail: venue.askTakeawayEmail ? email : undefined,
      lines,
    });
    if (!result.ok) {
      setNotice(result.error);
      return;
    }
      setDraft({});
      setNotes({});
      setName("");
      setPhone("");
      setEmail("");
    setNotice(`Sent ${queueNumber}`);
  }

  return (
    <>
      <main className="till-workspace">
        <MenuGrid
          menu={venue.menu}
          qtyByItem={draft}
          notesByItem={notes}
          onAdd={(id) => {
            setNotice(null);
            setDraft((d) => bumpQty(d, id, 1));
          }}
          onRemove={(id) => {
            setDraft((d) => {
              const next = bumpQty(d, id, -1);
              if (!next[id]) {
                setNotes((n) => {
                  const copy = { ...n };
                  delete copy[id];
                  return copy;
                });
              }
              return next;
            });
          }}
          onNote={(id, text) => setNotes((n) => ({ ...n, [id]: text }))}
        />
      </main>
      <BillPanel
        title={queueNumber}
        lines={lines}
        venue={venue}
        extra={
          <>
            <p className="till-muted">Counter</p>
            <label className="till-name">
              Name (optional)
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Sarah"
              />
            </label>
            {venue.askTakeawayPhone ? (
              <label className="till-name">
                Phone
                <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="04…" inputMode="tel" />
              </label>
            ) : null}
            {venue.askTakeawayEmail ? (
              <label className="till-name">
                Email
                <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="sarah@…" inputMode="email" />
              </label>
            ) : null}
          </>
        }
        primaryLabel="Send"
        primaryDisabled={lines.length === 0}
        onPrimary={send}
      >
        {notice ? <p className={notice.startsWith("Sent") ? "till-ok" : "till-error"}>{notice}</p> : null}
      </BillPanel>
    </>
  );
}
