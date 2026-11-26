import type { DeskSection } from "@lumen/domain";
import { useState } from "react";
import { createRoot } from "react-dom/client";
import OperationsDesk from "./OperationsDesk.js";
import { installDeskStyles } from "./styles.js";

const SECTIONS: { id: DeskSection; label: string }[] = [
  { id: "today", label: "Today" },
  { id: "rooms", label: "Rooms" },
  { id: "reservations", label: "Reservations" },
  { id: "guests", label: "Guests" },
  { id: "requests", label: "Requests" },
];

function Standalone() {
  installDeskStyles();
  const [section, setSection] = useState<DeskSection>("today");
  return (
    <div className="standalone">
      <header className="standalone-bar">
        <strong>Operations</strong>
        <nav>
          {SECTIONS.map((item) => (
            <button
              key={item.id}
              className={item.id === section ? "is-active" : ""}
              onClick={() => setSection(item.id)}
            >
              {item.label}
            </button>
          ))}
        </nav>
      </header>
      <OperationsDesk section={section} />
    </div>
  );
}

const root = document.getElementById("root");
if (root) createRoot(root).render(<Standalone />);
