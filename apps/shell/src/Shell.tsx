import { BUSINESS_DATE, formatLongDate, type DeskSection } from "@lumen/domain";
import { Component, lazy, Suspense, useEffect, useMemo, useState, type ReactNode } from "react";
import { CommandPalette } from "./palette.js";

const SECTIONS: { id: DeskSection; label: string; hint: string; path: string }[] = [
  { id: "today", label: "Today", hint: "Briefing", path: "/" },
  { id: "rooms", label: "Rooms", hint: "Floors", path: "/rooms" },
  { id: "reservations", label: "Reservations", hint: "Stays", path: "/reservations" },
  { id: "guests", label: "Guests", hint: "People", path: "/guests" },
  { id: "requests", label: "Requests", hint: "House", path: "/requests" },
];

const actionsUrl = import.meta.env.VITE_ACTIONS_URL ?? "http://localhost:4002";

export function Shell() {
  const [section, setSection] = useSection();
  const [focusId, setFocusId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [linked, setLinked] = useState(false);
  const Desk = useMemo(() => lazy(() => import("operations/OperationsDesk")), [attempt]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    let closed = false;
    const ping = async () => {
      try {
        const response = await fetch(`${actionsUrl}/health`);
        if (!closed) setLinked(response.ok);
      } catch {
        if (!closed) setLinked(false);
      }
    };
    void ping();
    const timer = window.setInterval(() => void ping(), 15000);
    return () => {
      closed = true;
      window.clearInterval(timer);
    };
  }, []);

  return (
    <div className="app">
      <aside className="rail">
        <div className="brand">
          <Mark />
          <div>
            <p className="eyebrow">Lumen</p>
            <h1>Harbor House</h1>
          </div>
        </div>
        <nav>
          {SECTIONS.map((item) => (
            <button
              key={item.id}
              className={item.id === section ? "nav is-active" : "nav"}
              onClick={() => {
                setFocusId(null);
                setSection(item.id);
              }}
            >
              <span>{item.label}</span>
              <small>{item.hint}</small>
            </button>
          ))}
        </nav>
        <div className="rail-foot">
          <p>Front desk · day watch</p>
          <p className="quiet">18 Lantern Walk, Seacliff</p>
        </div>
      </aside>
      <section className="stage">
        <header className="top">
          <p className="date">{formatLongDate(BUSINESS_DATE)}</p>
          <div className="top-actions">
            <span className={linked ? "link is-on" : "link"}>{linked ? "Desk linked" : "Desk offline"}</span>
            <button className="ask" type="button" onClick={() => setOpen(true)}>
              Ask the desk
              <kbd>Ctrl K</kbd>
            </button>
          </div>
        </header>
        <div className="remote-host">
          <RemoteBoundary key={attempt} onRetry={() => setAttempt((value) => value + 1)}>
            <Suspense fallback={<p className="remote-fallback">Opening the operations desk…</p>}>
              <Desk section={section} focusId={focusId} />
            </Suspense>
          </RemoteBoundary>
        </div>
      </section>
      <CommandPalette
        open={open}
        onClose={() => setOpen(false)}
        onFocus={(next, id) => {
          setSection(next);
          setFocusId(id);
        }}
      />
    </div>
  );
}

function useSection(): [DeskSection, (section: DeskSection) => void] {
  const [section, setSectionState] = useState<DeskSection>(() => sectionFromPath(window.location.pathname));
  useEffect(() => {
    const onPop = () => setSectionState(sectionFromPath(window.location.pathname));
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);
  const setSection = (next: DeskSection) => {
    const path = SECTIONS.find((item) => item.id === next)?.path ?? "/";
    if (window.location.pathname !== path) window.history.pushState({}, "", path);
    setSectionState(next);
  };
  return [section, setSection];
}

function sectionFromPath(path: string): DeskSection {
  return SECTIONS.find((item) => item.path === path)?.id ?? "today";
}

class RemoteBoundary extends Component<{ children: ReactNode; onRetry: () => void }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError(): { failed: boolean } {
    return { failed: true };
  }

  render() {
    if (this.state.failed) {
      return (
        <div className="remote-error">
          <p>The operations desk has not joined the shell yet. It is a separate app on port 5174.</p>
          <button type="button" onClick={this.props.onRetry}>
            Try again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

function Mark() {
  return (
    <svg className="mark" width="36" height="36" viewBox="0 0 36 36" aria-hidden="true">
      <rect x="1" y="1" width="34" height="34" rx="10" fill="#241e19" stroke="#3a322b" />
      <path d="M8 24c4.2-8 15.8-8 20 0" fill="none" stroke="#c4a574" strokeWidth="1.6" />
      <circle cx="18" cy="13" r="2.2" fill="#c4a574" />
    </svg>
  );
}
