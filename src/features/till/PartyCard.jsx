import { formatClock, formatDay, partyTag } from "../../services/pos";

export function PartyCard({ state, party, selected, onSelect }) {
  if (!party) return null;
  const tag = partyTag(state, party);
  const Tag = onSelect ? "button" : "div";
  return (
    <Tag
      type={onSelect ? "button" : undefined}
      className={`till-party${selected ? " on" : ""}${tag ? ` ${tag.kind}` : ""}`}
      onClick={onSelect}
    >
      <div className="till-party-top">
        <strong>{party.name}</strong>
        {tag ? <span className={`till-party-tag ${tag.kind}`}>{tag.label}</span> : null}
      </div>
      <span>
        {formatClock(party.at)}
        {party.tableId ? ` · Table ${party.tableId}` : " · no table"}
        {party.covers ? ` · ${party.covers} guests` : ""}
      </span>
      {party.phone ? <span>{party.phone}</span> : null}
      {party.note ? <span>{party.note}</span> : null}
      {party.walkIn ? <span>Walk-in</span> : <span>{formatDay(party.at)}</span>}
    </Tag>
  );
}
