import type { DeskSection } from "@lumen/domain";
import { useEffect } from "react";
import { useHotelModel } from "./model.js";
import { Guests, Requests, Reservations, Rooms, Today } from "./screens.js";
import { installDeskStyles } from "./styles.js";

const TITLES: Record<DeskSection, string> = {
  today: "Today",
  rooms: "Rooms",
  reservations: "Reservations",
  guests: "Guests",
  requests: "Requests",
};

export interface OperationsDeskProps {
  section: DeskSection;
  focusId?: string | null;
}

export default function OperationsDesk({ section, focusId = null }: OperationsDeskProps) {
  installDeskStyles();
  const model = useHotelModel();

  useEffect(() => {
    if (!focusId) return;
    document.getElementById(`record-${focusId}`)?.scrollIntoView({ block: "center" });
  }, [focusId, section, model.state]);

  if (model.error && !model.state) {
    return (
      <div className="desk">
        <p className="banner">{model.error}</p>
      </div>
    );
  }
  if (!model.state) {
    return (
      <div className="desk">
        <p className="banner">Loading the house…</p>
      </div>
    );
  }

  const state = model.state;
  return (
    <div className="desk">
      <header className="desk-head">
        <div>
          <p className="kicker">{state.property.name}</p>
          <h2>{TITLES[section]}</h2>
        </div>
        <p className="when">{state.property.city}</p>
      </header>
      {section === "today" ? <Today state={state} /> : null}
      {section === "rooms" ? <Rooms state={state} fresh={model.fresh} focusId={focusId} /> : null}
      {section === "reservations" ? (
        <Reservations state={state} fresh={model.fresh} focusId={focusId} />
      ) : null}
      {section === "guests" ? <Guests state={state} focusId={focusId} /> : null}
      {section === "requests" ? <Requests state={state} fresh={model.fresh} focusId={focusId} /> : null}
    </div>
  );
}
