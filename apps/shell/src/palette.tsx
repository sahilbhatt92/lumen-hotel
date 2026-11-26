import { dispatchPalette, sectionForHit, type PaletteResult } from "@lumen/palette";
import { useEffect, useRef, useState } from "react";

const EXAMPLES = [
  "find room 214",
  "check in LH-1842",
  "what is the late checkout policy?",
  "can I cancel LH-1871 without a fee?",
];

const endpoints = {
  searchUrl: import.meta.env.VITE_SEARCH_URL ?? "http://localhost:4001",
  actionsUrl: import.meta.env.VITE_ACTIONS_URL ?? "http://localhost:4002",
  docsUrl: import.meta.env.VITE_DOCS_URL ?? "http://localhost:4003",
};

export function CommandPalette({
  open,
  onClose,
  onFocus,
}: {
  open: boolean;
  onClose: () => void;
  onFocus: (section: ReturnType<typeof sectionForHit>, id: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<PaletteResult | null>(null);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    const frame = window.requestAnimationFrame(() => input.current?.focus());
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  if (!open) return null;

  const submit = async (value: string) => {
    const next = value.trim();
    if (!next || pending) return;
    setQuery(next);
    setPending(true);
    setResult(null);
    const response = await dispatchPalette(next, endpoints);
    setResult(response);
    setPending(false);
  };

  return (
    <div className="palette-back" onMouseDown={onClose}>
      <div
        className="palette"
        role="dialog"
        aria-modal="true"
        aria-label="Ask the desk"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void submit(query);
          }}
        >
          <label htmlFor="desk-query">Ask Harbor House</label>
          <input
            id="desk-query"
            ref={input}
            data-testid="command-input"
            value={query}
            placeholder="Search, check a guest in, or ask a policy question"
            onChange={(event) => setQuery(event.target.value)}
          />
        </form>
        <div className="palette-body" data-testid="command-result" aria-live="polite">
          {pending ? <p className="result">Looking that up…</p> : null}
          {!pending && !result ? (
            <div className="examples">
              {EXAMPLES.map((example) => (
                <button key={example} type="button" onClick={() => void submit(example)}>
                  {example}
                </button>
              ))}
            </div>
          ) : null}
          {result && !result.ok ? <p className="result is-bad">{result.message}</p> : null}
          {result && result.ok && result.kind === "search" ? (
            <div className="hits">
              {result.response.hits.length === 0 ? <p className="result">Nothing on the desk matches.</p> : null}
              {result.response.hits.map((hit) => (
                <button
                  key={`${hit.kind}-${hit.id}`}
                  className="hit"
                  type="button"
                  onClick={() => {
                    onFocus(sectionForHit(hit.kind), hit.id);
                    onClose();
                  }}
                >
                  {hit.title}
                  <small>{hit.subtitle}</small>
                </button>
              ))}
            </div>
          ) : null}
          {result && result.ok && result.kind === "actions" ? (
            <div className={result.response.ok ? "result" : "result is-bad"}>
              <p>{result.response.message}</p>
            </div>
          ) : null}
          {result && result.ok && result.kind === "docs" ? (
            <div className="result">
              <p>{result.response.text}</p>
              {result.response.citations.map((citation) => (
                <div className="citation" key={citation.id}>
                  <strong>
                    {citation.title} — {citation.heading}
                  </strong>
                  <small>{citation.excerpt}</small>
                </div>
              ))}
            </div>
          ) : null}
        </div>
        <div className="palette-foot">
          <span>Search · Actions · Policies</span>
          <span>Enter to ask · Esc to close</span>
        </div>
      </div>
    </div>
  );
}
