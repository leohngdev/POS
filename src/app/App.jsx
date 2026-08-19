import { PosProvider, usePos } from "../features/till/PosProvider";
import { PinGate } from "../features/till/PinGate";
import { TillShell } from "../features/till/TillShell";
import "../features/till/till.css";

function Gate() {
  const { state } = usePos();
  return state.unlocked ? <TillShell /> : <PinGate />;
}

export default function App() {
  return (
    <PosProvider>
      <Gate />
    </PosProvider>
  );
}
