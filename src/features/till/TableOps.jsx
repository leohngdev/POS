export function TableOps({ showMove, targets, moving, onToggleMove, onMoveTo, canVoid, onVoid }) {
  if (!showMove && !onVoid) return null;
  return (
    <div className="till-table-ops">
      {showMove ? (
        <button type="button" className="till-ghost till-inline" onClick={onToggleMove}>
          {moving ? "Cancel move" : "Move table"}
        </button>
      ) : null}
      {moving ? (
        <div className="till-move-targets">
          {targets.length === 0 ? (
            <p className="till-muted">No other tables</p>
          ) : (
            targets.map((id) => (
              <button key={id} type="button" className="till-table till-table-sm" onClick={() => onMoveTo(id)}>
                {id}
              </button>
            ))
          )}
        </div>
      ) : null}
      {onVoid ? (
        <button type="button" className="till-reject till-inline" disabled={!canVoid} onClick={onVoid}>
          Void last Send
        </button>
      ) : null}
    </div>
  );
}
