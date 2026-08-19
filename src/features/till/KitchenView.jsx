import { useEffect, useState } from "react";
import { LATE_MS, activeChits, checkLabel } from "../../services/pos";
import { usePos } from "./PosProvider";

export function KitchenView() {
  const { state, bump, undoBump } = usePos();
  const [filter, setFilter] = useState("all");
  const [, setTick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setTick((n) => n + 1), 30000);
    return () => clearInterval(id);
  }, []);

  const checksById = Object.fromEntries(state.checks.map((c) => [c.id, c]));
  let chits = activeChits(state);
  if (filter === "dine-in") chits = chits.filter((c) => checksById[c.checkId]?.channel === "dine-in");
  if (filter === "takeaway") chits = chits.filter((c) => checksById[c.checkId]?.channel === "takeaway");

  function age(chit) {
    return Date.now() - chit.sentAt;
  }

  return (
    <main className="till-workspace till-kitchen">
      <div className="till-strip">
        {[
          ["all", "All"],
          ["dine-in", "Dine in"],
          ["takeaway", "Takeaway"],
        ].map(([id, label]) => (
          <button
            key={id}
            type="button"
            className={filter === id ? "till-table till-table-sm on" : "till-table till-table-sm"}
            onClick={() => setFilter(id)}
          >
            {label}
          </button>
        ))}
        <button type="button" className="till-ghost" onClick={() => undoBump()} disabled={!state.lastBumpedChitId}>
          Undo bump
        </button>
      </div>
      {chits.length === 0 ? (
        <p className="till-empty">Nothing to cook</p>
      ) : (
        <div className="till-chit-row">
          {chits.map((chit) => {
            const check = checksById[chit.checkId];
            const late = age(chit) >= LATE_MS;
            const mins = Math.max(0, Math.floor(age(chit) / 60000));
            return (
              <article key={chit.id} className={chit.more ? "till-chit more" : "till-chit"}>
                <div className="till-identity">
                  {check ? checkLabel(check) : chit.checkId}
                  {chit.more ? " · MORE" : ""}
                </div>
                <div className={late ? "till-timer late" : "till-timer"}>{mins}m</div>
                <ul className="till-chit-lines">
                  {chit.lines.map((line) => (
                    <li key={line.itemId}>
                      x{line.qty} {line.name}
                    </li>
                  ))}
                </ul>
                <button
                  type="button"
                  className="till-primary"
                  onClick={() => bump(chit.id)}
                >
                  Bump
                </button>
              </article>
            );
          })}
        </div>
      )}
    </main>
  );
}
