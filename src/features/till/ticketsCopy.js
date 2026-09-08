import { formatClock, formatDay } from "../../services/pos";

/** Tonight’s paid pile is not the reprint drawer — History is. */
export const TICKETS_PAID_HINT = "Tonight only. Reprint after close from History.";
export const TICKETS_PAID_NONE = "None tonight";
export const TICKETS_EMPTY_CONTEXT = "Select a check. Last night’s tickets are on History.";
export const HISTORY_EMPTY = "No receipts yet. Paid tickets stay here after end of night.";
export const HISTORY_NONE = "Nothing to reprint. Last night’s tickets stay here after close.";

export function receiptWhen(receipt) {
  if (receipt?.at == null) return "";
  return `${formatDay(receipt.at)} · ${formatClock(receipt.at)}`;
}
