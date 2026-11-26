import { applyEvent, touchedIds, type DomainEvent, type HotelState } from "@lumen/domain";
import { useEffect, useRef, useState } from "react";

const actionsUrl = import.meta.env.VITE_ACTIONS_URL ?? "http://localhost:4002";

export function useHotelModel(): {
  state: HotelState | null;
  error: string | null;
  fresh: ReadonlySet<string>;
} {
  const [state, setState] = useState<HotelState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fresh, setFresh] = useState<ReadonlySet<string>>(new Set());
  const loaded = useRef(false);

  useEffect(() => {
    let closed = false;
    const timers = new Set<number>();

    const mark = (ids: string[]) => {
      if (!ids.length) return;
      setFresh((current) => new Set([...current, ...ids]));
      const timer = window.setTimeout(() => {
        timers.delete(timer);
        setFresh((current) => {
          const next = new Set(current);
          for (const id of ids) next.delete(id);
          return next;
        });
      }, 2200);
      timers.add(timer);
    };

    const load = async () => {
      try {
        const response = await fetch(`${actionsUrl}/state`);
        if (!response.ok) throw new Error(String(response.status));
        const next = (await response.json()) as HotelState;
        if (closed) return;
        loaded.current = true;
        setState(next);
        setError(null);
      } catch {
        if (!closed && !loaded.current) {
          setError("The actions service is not reachable. Run npm run dev from the repository root.");
        }
      }
    };

    void load();
    const source = new EventSource(`${actionsUrl}/events`);
    source.onopen = () => {
      void load();
    };
    source.onmessage = (message) => {
      const event = JSON.parse(message.data) as DomainEvent;
      setState((current) => (current ? applyEvent(current, event) : current));
      mark(touchedIds(event));
    };
    source.onerror = () => {
      if (!closed && !loaded.current) {
        setError("The actions service is not reachable. Run npm run dev from the repository root.");
      }
    };

    return () => {
      closed = true;
      source.close();
      for (const timer of timers) window.clearTimeout(timer);
    };
  }, []);

  return { state, error, fresh };
}
