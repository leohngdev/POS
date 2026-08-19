export const STORAGE_KEY = "pos.till.v1";
export const SCHEMA = 1;

export function toSnapshot(state) {
  return {
    schema: SCHEMA,
    checks: state.checks,
    chits: state.chits,
    nextCheck: state.nextCheck,
    nextChit: state.nextChit,
    nextTakeaway: state.nextTakeaway,
    lastBumpedChitId: state.lastBumpedChitId,
    venue: {
      gstEnabled: Boolean(state.venue.gstEnabled),
      gstRate: state.venue.gstRate,
      surchargeEnabled: Boolean(state.venue.surchargeEnabled),
      surchargeRate: state.venue.surchargeRate,
    },
  };
}

export function fromSnapshot(raw, baseState) {
  if (!raw || raw.schema !== SCHEMA || !Array.isArray(raw.checks) || !Array.isArray(raw.chits)) {
    return null;
  }
  return {
    ...baseState,
    unlocked: false,
    pinError: null,
    checks: raw.checks,
    chits: raw.chits,
    nextCheck: Number(raw.nextCheck) || 1,
    nextChit: Number(raw.nextChit) || 1,
    nextTakeaway: Number(raw.nextTakeaway) || 1,
    lastBumpedChitId: raw.lastBumpedChitId ?? null,
    venue: {
      ...baseState.venue,
      ...raw.venue,
    },
  };
}

export function readStore(storage) {
  try {
    const text = storage.getItem(STORAGE_KEY);
    if (!text) return null;
    return JSON.parse(text);
  } catch {
    return null;
  }
}

export function writeStore(state, storage) {
  storage.setItem(STORAGE_KEY, JSON.stringify(toSnapshot(state)));
}

export function loadState(baseState, storage) {
  return fromSnapshot(readStore(storage), baseState) ?? baseState;
}
