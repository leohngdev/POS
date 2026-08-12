import { useState } from "react";
import { DemoShell } from "../features/demo/DemoShell";
import "../features/demo/canvas.css";

/** Admin shell — sidebar + workspace. Archetype canvas (disposable). */
export default function App() {
  const [section, setSection] = useState("Records");
  return (
    <div className="canvas-root admin-layout">
      <aside className="admin-side">
        <div className="brand" style={{ fontWeight: 800, letterSpacing: "0.08em" }}>ADMIN</div>
        <nav>
          {["Records", "Users", "Settings"].map((item) => (
            <button key={item} className={section === item ? "active" : ""} onClick={() => setSection(item)} type="button">
              {item}
            </button>
          ))}
        </nav>
      </aside>
      <DemoShell section={section} />
    </div>
  );
}
