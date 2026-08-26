export function ClaimActions({ status, onAccept, onReject }) {
  if (!status) return null;
  return (
    <div className="till-claim-actions">
      {status === "pending" ? (
        <button type="button" className="till-accept" onClick={onAccept}>
          Accept
        </button>
      ) : null}
      <button type="button" className="till-reject" onClick={onReject}>
        Reject
      </button>
    </div>
  );
}
