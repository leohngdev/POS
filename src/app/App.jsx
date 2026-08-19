import { PosProvider, usePos } from "../features/till/PosProvider";
import { PinGate } from "../features/till/PinGate";
import { TillShell } from "../features/till/TillShell";
import { GuestOrder } from "../features/guest/GuestOrder";
import { useGuestRoute } from "../features/guest/guestRoute";
import "../features/till/till.css";

function Gate() {
  const { state } = usePos();
  const guest = useGuestRoute();
  if (guest.isGuest) return <GuestOrder initialTable={guest.tableId} />;
  return state.unlocked ? <TillShell /> : <PinGate />;
}

export default function App() {
  return (
    <PosProvider>
      <Gate />
    </PosProvider>
  );
}
