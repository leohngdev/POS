import { SCHEMA } from "./persist";

export function createSnapshotStore(initial = { rev: 0, snapshot: null }) {
  let rev = Number(initial.rev) || 0;
  let snapshot = initial.snapshot ?? null;

  return {
    get() {
      return { rev, snapshot };
    },
    put(clientRev, nextSnapshot) {
      if (clientRev !== rev) {
        return { ok: false, conflict: true, rev, snapshot };
      }
      if (!isSnapshot(nextSnapshot)) {
        return { ok: false, conflict: false, rev, snapshot, error: "Invalid snapshot." };
      }
      rev += 1;
      snapshot = nextSnapshot;
      return { ok: true, conflict: false, rev, snapshot };
    },
  };
}

export function isSnapshot(raw) {
  return Boolean(raw && raw.schema === SCHEMA && Array.isArray(raw.checks) && Array.isArray(raw.chits));
}
