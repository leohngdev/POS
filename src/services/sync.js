import { createInitialState } from "./pos";
import { fromSnapshot, toSnapshot } from "./persist";

export const SNAPSHOT_URL = "/api/snapshot";
export const POLL_MS = 1500;

export async function pullSnapshot(fetcher = fetch) {
  try {
    const res = await fetcher(SNAPSHOT_URL);
    if (!res.ok) return { ok: false, error: "offline" };
    const data = await res.json();
    return { ok: true, rev: Number(data.rev) || 0, snapshot: data.snapshot ?? null };
  } catch {
    return { ok: false, error: "offline" };
  }
}

export async function pushSnapshot(rev, snapshot, fetcher = fetch) {
  try {
    const res = await fetcher(SNAPSHOT_URL, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rev, snapshot }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.status === 409) {
      return { ok: false, conflict: true, rev: Number(data.rev) || 0, snapshot: data.snapshot ?? null };
    }
    if (!res.ok) return { ok: false, conflict: false, error: "offline" };
    return { ok: true, rev: Number(data.rev) || 0, snapshot: data.snapshot ?? null };
  } catch {
    return { ok: false, conflict: false, error: "offline" };
  }
}

export function sessionize(snapshot, session) {
  const loaded = fromSnapshot(snapshot, createInitialState());
  const base = loaded ?? createInitialState();
  return { ...base, unlocked: session.unlocked, pinError: session.pinError };
}

export function hasLocalService(state) {
  return (
    (state.checks?.length ?? 0) > 0 ||
    (state.chits?.length ?? 0) > 0 ||
    Object.keys(state.guestClaims ?? {}).length > 0
  );
}

export async function applyOnVenue(apply, session, localState, { pull, push }) {
  const pulled = await pull();
  let base = localState;
  let rev = session.rev;
  let status = pulled.ok ? "live" : "local";

  if (pulled.ok && pulled.snapshot) {
    base = sessionize(pulled.snapshot, session);
    rev = pulled.rev;
  }

  const result = apply(base);
  const next = result.ok ? result.state : base;
  if (!result.ok) {
    return { result, next, rev, status };
  }

  const snap = toSnapshot(next);
  let pushed = await push(rev, snap);
  if (pushed.ok) {
    return { result, next, rev: pushed.rev, status: "live" };
  }
  if (pushed.conflict && pushed.snapshot) {
    const retryBase = sessionize(pushed.snapshot, session);
    const retry = apply(retryBase);
    const retryNext = retry.ok ? retry.state : retryBase;
    if (!retry.ok) {
      return { result: retry, next: retryNext, rev: pushed.rev, status: "live" };
    }
    const again = await push(pushed.rev, toSnapshot(retryNext));
    if (again.ok) {
      return { result: retry, next: retryNext, rev: again.rev, status: "live" };
    }
    return { result: retry, next: retryNext, rev: pushed.rev, status: "local" };
  }
  return { result, next, rev, status: "local" };
}
