import { TABLE_GAP, TABLE_H, TABLE_W, tableFloorStatus, tableClaimStatus } from "../../services/pos";

function tableClass(selected, claim, floor, shape) {
  const parts = ["till-floor-table", shape === "round" ? "round" : "square"];
  if (selected) parts.push("on");
  if (claim === "pending") parts.push("claimed");
  if (claim === "accepted") parts.push("seated");
  if (floor === "cooking" || floor === "ready") parts.push(floor);
  return parts.join(" ");
}

export function FloorMap({
  tables,
  state,
  selectedId,
  onSelect,
  editor,
  onMove,
  childrenFor,
}) {
  const records = tables ?? [];
  const width = Math.max(420, ...records.map((t) => (t.x ?? 0) + TABLE_W + TABLE_GAP));
  const height = Math.max(280, ...records.map((t) => (t.y ?? 0) + TABLE_H + TABLE_GAP));

  function startDrag(event, table) {
    if (!editor || !onMove) return;
    event.preventDefault();
    event.stopPropagation();
    const cell = event.currentTarget.parentElement;
    const startX = event.clientX;
    const startY = event.clientY;
    const origX = table.x;
    const origY = table.y;
    let last = { x: origX, y: origY };
    function move(ev) {
      last = {
        x: Math.max(0, Math.round((origX + ev.clientX - startX) / 8) * 8),
        y: Math.max(0, Math.round((origY + ev.clientY - startY) / 8) * 8),
      };
      if (cell) {
        cell.style.left = `${last.x}px`;
        cell.style.top = `${last.y}px`;
      }
    }
    function up() {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      if (last.x !== origX || last.y !== origY) onMove(table.id, last);
    }
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  }

  if (records.length === 0) {
    return <p className="till-empty">No tables on this floor</p>;
  }

  return (
    <div className={`till-floor${editor ? " editing" : ""}`} style={{ width, minHeight: height }}>
      {records.map((table) => {
        const claim = state ? tableClaimStatus(state, table.id) : null;
        const floor = state ? tableFloorStatus(state, table.id) : "empty";
        const floorTag = floor === "cooking" ? "Cooking" : floor === "ready" ? "To pay" : null;
        const guestTag = claim === "pending" ? "Guest" : claim === "accepted" ? "Seated" : null;
        return (
          <div
            key={table.id}
            className="till-floor-cell"
            style={{ left: table.x, top: table.y, width: TABLE_W }}
          >
            <button
              type="button"
              className={tableClass(selectedId === table.id, claim, floor, table.shape)}
              onClick={() => onSelect?.(table.id)}
              onPointerDown={editor ? (e) => startDrag(e, table) : undefined}
            >
              {table.id}
              {guestTag ? <span className="till-claim-tag">{guestTag}</span> : null}
              {floorTag && claim !== "pending" ? <span className="till-claim-tag">{floorTag}</span> : null}
            </button>
            {childrenFor ? childrenFor(table) : null}
          </div>
        );
      })}
    </div>
  );
}
