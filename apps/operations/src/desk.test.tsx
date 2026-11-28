/** @vitest-environment jsdom */
import { applyEvent, checkIn, createSeedState } from "@lumen/domain";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { ReservationTable } from "./screens.js";

afterEach(() => cleanup());

describe("operations desk", () => {
  it("shows a stay as in house after the check-in event", () => {
    const state = createSeedState();
    const { rerender } = render(
      <ReservationTable state={state} rows={state.reservations} fresh={new Set()} focusId={null} />,
    );
    expect(screen.getByTestId("status-LH-1842").textContent).toMatch(/confirmed/i);

    const outcome = checkIn(state, "LH-1842");
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    let next = state;
    for (const event of outcome.events) next = applyEvent(next, event);

    rerender(
      <ReservationTable state={next} rows={next.reservations} fresh={new Set(["LH-1842"])} focusId="LH-1842" />,
    );
    expect(screen.getByTestId("status-LH-1842").textContent).toMatch(/in house/i);
    expect(screen.getByTestId("status-LH-1842").closest("tr")?.className).toMatch(/is-fresh/);
  });
});
