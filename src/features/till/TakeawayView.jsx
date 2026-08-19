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
  const [name, setName] = useState("");
  const [notice, setNotice] = useState(null);
  const queueNumber = nextQueueNumber(state.nextTakeaway);
  const lines = useMemo(() => compactLines(draft, venue.menu), [draft, venue.menu]);

  function send() {
    const result = sendOrder({
      channel: "takeaway",
      tableId: null,
      queueNumber,
      guestName: name,
      lines,
    });
    if (!result.ok) {
      setNotice(result.error);
      return;
    }
    setDraft({});
    setName("");
    setNotice(`Sent ${queueNumber}`);
  }

  return (
    <>
      <main className="till-workspace">
        <MenuGrid
          menu={venue.menu}
          qtyByItem={draft}
          onAdd={(id) => {
            setNotice(null);
            setDraft((d) => bumpQty(d, id, 1));
          }}
          onRemove={(id) => setDraft((d) => bumpQty(d, id, -1))}
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
