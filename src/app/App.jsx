import { PosProvider, usePos } from "../features/till/PosProvider";
import { PinGate } from "../features/till/PinGate";
import { TillShell } from "../features/till/TillShell";
import { GuestOrder } from "../features/guest/GuestOrder";
import { ClockPage } from "../features/staff/ClockPage";
import { useClockRoute, useGuestRoute } from "../features/guest/guestRoute";
import "../features/till/till.css";

function Gate() {
  const { state } = usePos();
  const guest = useGuestRoute();
  const clock = useClockRoute();
  if (guest.isGuest) return <GuestOrder initialTable={guest.tableId} />;
  if (clock) return <ClockPage />;
  return state.unlocked ? <TillShell key={state.onStaff?.id ?? "open"} /> : <PinGate />;
}

export default function App() {
  return (
    <PosProvider>
      <Gate />
      <div id="till-print-root" />
    </PosProvider>
  );
}
