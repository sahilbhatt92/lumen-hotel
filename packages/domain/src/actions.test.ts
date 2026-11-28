import { describe, expect, it } from "vitest";
import { applyEvent } from "./apply.js";
import {
  advanceStaffRequest,
  assessCancellation,
  assessCheckIn,
  assignRoom,
  cancelReservation,
  checkIn,
  checkOut,
  createReservation,
  logStaffRequest,
} from "./actions.js";
import { createSeedState } from "./seed.js";
import { summarizeDay } from "./text.js";

describe("seed", () => {
  it("keeps rooms, guests, and in-house status consistent", () => {
    const state = createSeedState();
    for (const reservation of state.reservations) {
      expect(state.guests.some((guest) => guest.id === reservation.guestId)).toBe(true);
      if (reservation.roomNumber) {
        expect(state.rooms.some((room) => room.number === reservation.roomNumber)).toBe(true);
      }
      if (reservation.status === "in_house" && reservation.roomNumber) {
        const room = state.rooms.find((item) => item.number === reservation.roomNumber);
        expect(room?.status).toBe("occupied");
      }
    }
  });
});

describe("check-in", () => {
  it("moves a ready arrival in house and occupies the room", () => {
    const state = createSeedState();
    const outcome = checkIn(state, "LH-1842");
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    const reservation = outcome.state.reservations.find((item) => item.id === "LH-1842");
    const room = outcome.state.rooms.find((item) => item.number === "214");
    expect(reservation?.status).toBe("in_house");
    expect(room?.status).toBe("occupied");
    expect(outcome.state.revision).toBe(state.revision + 1);

    let ui = state;
    for (const event of outcome.events) ui = applyEvent(ui, event);
    expect(ui.reservations.find((item) => item.id === "LH-1842")?.status).toBe("in_house");
    expect(ui.rooms.find((item) => item.number === "214")?.status).toBe("occupied");
    expect(summarizeDay(outcome.state)).not.toBe(summarizeDay(state));
  });

  it("rejects an arrival with no room, a dirty room, and a guest already in house", () => {
    const state = createSeedState();
    expect(checkIn(state, "LH-1860").ok).toBe(false);
    const dirty = {
      ...state,
      reservations: state.reservations.map((reservation) =>
        reservation.id === "LH-1842" ? { ...reservation, roomNumber: "104" } : reservation,
      ),
    };
    const blocked = checkIn(dirty, "LH-1842");
    expect(blocked.ok).toBe(false);
    if (!blocked.ok) expect(blocked.code).toBe("room_not_ready");
    expect(checkIn(state, "LH-1848").ok).toBe(false);
  });

  it("assesses readiness without changing the house", () => {
    const state = createSeedState();
    const ready = assessCheckIn(state, "LH-1842");
    const blocked = assessCheckIn(state, "LH-1860");
    expect(ready.ok).toBe(true);
    expect(blocked.ok).toBe(true);
    if (!ready.ok || !blocked.ok) return;
    expect(ready.changed).toBe(false);
    expect(ready.message.startsWith("Yes.")).toBe(true);
    expect(blocked.message.startsWith("No.")).toBe(true);
    expect(ready.state.revision).toBe(state.revision);
  });
});

describe("assignment, checkout, and cancellation", () => {
  it("assigns a clean room and then allows check-in", () => {
    const state = createSeedState();
    const assigned = assignRoom(state, "LH-1860", "222");
    expect(assigned.ok).toBe(true);
    if (!assigned.ok) return;
    expect(assigned.state.rooms.find((room) => room.number === "222")?.status).toBe("vacant");
    const checked = checkIn(assigned.state, "LH-1860");
    expect(checked.ok).toBe(true);
    if (!checked.ok) return;
    expect(checked.state.rooms.find((room) => room.number === "222")?.status).toBe("occupied");
  });

  it("refuses an occupied or out-of-order room", () => {
    const state = createSeedState();
    const occupied = assignRoom(state, "LH-1860", "305");
    const closed = assignRoom(state, "LH-1860", "208");
    expect(occupied.ok).toBe(false);
    expect(closed.ok).toBe(false);
  });

  it("checks a guest out and marks the room dirty", () => {
    const state = createSeedState();
    const outcome = checkOut(state, "LH-1866");
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.state.reservations.find((item) => item.id === "LH-1866")?.status).toBe("checked_out");
    expect(outcome.state.rooms.find((room) => room.number === "118")?.status).toBe("dirty");
  });

  it("cancels outside the window for free and keeps the first night inside it", () => {
    const state = createSeedState();
    const free = cancelReservation(state, "LH-1871");
    const assessed = assessCancellation(state, "LH-1877");
    expect(free.ok).toBe(true);
    if (free.ok) {
      expect(free.message).toMatch(/no fee/i);
      expect(free.state.reservations.find((item) => item.id === "LH-1871")?.status).toBe("cancelled");
    }
    expect(assessed.ok).toBe(true);
    if (assessed.ok) {
      expect(assessed.changed).toBe(false);
      expect(assessed.message).toMatch(/first night/i);
      expect(assessed.state.reservations.find((item) => item.id === "LH-1877")?.status).toBe("confirmed");
    }
  });
});

describe("reservations and staff requests", () => {
  it("creates a reservation for an existing guest", () => {
    const state = createSeedState();
    const outcome = createReservation(state, {
      name: "create_reservation",
      guestName: "Elena Voss",
      arrival: "2026-12-01",
      departure: "2026-12-03",
    });
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.state.reservations[0]?.id).toBe("LH-1900");
    expect(outcome.state.reservations[0]?.guestId).toBe("g-elena");
    expect(outcome.state.guests).toHaveLength(state.guests.length);
  });

  it("logs a request and advances it to done", () => {
    const state = createSeedState();
    const logged = logStaffRequest(state, "housekeeping", "Extra towels", "222");
    expect(logged.ok).toBe(true);
    if (!logged.ok) return;
    const created = logged.state.staffRequests[0];
    expect(created?.status).toBe("open");
    const started = advanceStaffRequest(logged.state, created!.id);
    expect(started.ok).toBe(true);
    if (!started.ok) return;
    const finished = advanceStaffRequest(started.state, created!.id);
    expect(finished.ok).toBe(true);
    if (!finished.ok) return;
    expect(finished.state.staffRequests.find((item) => item.id === created?.id)?.status).toBe("done");
    expect(advanceStaffRequest(finished.state, created!.id).ok).toBe(false);
  });
});
