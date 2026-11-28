import type {
  ActionFailure,
  ActionOutcome,
  ActionSuccess,
  Command,
  DomainEvent,
  Guest,
  HotelState,
  RequestKind,
  Reservation,
  Room,
  StaffRequest,
} from "./types.js";
import { guestName, nightsBetween, roomReady, roomStatusLabel } from "./text.js";

const COMMANDS = new Set<Command["name"]>([
  "check_in",
  "check_out",
  "assign_room",
  "cancel_reservation",
  "assess_check_in",
  "assess_cancellation",
  "create_reservation",
  "log_staff_request",
  "advance_staff_request",
]);

export function isCommand(value: unknown): value is Command {
  if (!value || typeof value !== "object") return false;
  const name = (value as { name?: unknown }).name;
  return typeof name === "string" && COMMANDS.has(name as Command["name"]);
}

export function perform(state: HotelState, command: Command): ActionOutcome {
  switch (command.name) {
    case "check_in":
    case "check_out":
    case "cancel_reservation":
    case "assess_check_in":
    case "assess_cancellation":
      if (!text(command.reservationId)) return fail("bad_request", "A reservation id is required.");
      break;
    case "assign_room":
      if (!text(command.reservationId) || !text(command.roomNumber)) {
        return fail("bad_request", "Assigning a room needs a reservation id and a room number.");
      }
      break;
    case "create_reservation":
      break;
    case "log_staff_request":
      if (!text(command.summary)) return fail("bad_request", "A request needs a short summary.");
      break;
    case "advance_staff_request":
      if (!text(command.requestId)) return fail("bad_request", "A request id is required.");
      break;
    default:
      return fail("bad_request", "That operation is not on the desk.");
  }

  switch (command.name) {
    case "check_in":
      return checkIn(state, command.reservationId);
    case "check_out":
      return checkOut(state, command.reservationId);
    case "assign_room":
      return assignRoom(state, command.reservationId, command.roomNumber);
    case "cancel_reservation":
      return cancelReservation(state, command.reservationId);
    case "assess_check_in":
      return assessCheckIn(state, command.reservationId);
    case "assess_cancellation":
      return assessCancellation(state, command.reservationId);
    case "create_reservation":
      return createReservation(state, { ...command, guestName: command.guestName ?? "" });
    case "log_staff_request":
      return logStaffRequest(state, command.kind, command.summary, command.roomNumber);
    case "advance_staff_request":
      return advanceStaffRequest(state, command.requestId);
    default:
      return fail("bad_request", "That operation is not on the desk.");
  }
}

function text(value: string | undefined): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

export function checkIn(state: HotelState, reservationId: string): ActionOutcome {
  const checked = validateCheckIn(state, reservationId);
  if (!checked.ok) return checked;
  const nextReservation: Reservation = { ...checked.reservation, status: "in_house" };
  const nextRoom: Room = { ...checked.room, status: "occupied" };
  const next = commit(state, {
    reservations: replaceById(state.reservations, nextReservation),
    rooms: replaceById(state.rooms, nextRoom),
  });
  return success(
    next,
    `${guestName(state, checked.reservation.guestId)} is in house in room ${checked.room.number}.`,
    [
      { type: "reservation.upserted", reservation: nextReservation },
      { type: "room.updated", room: nextRoom },
    ],
  );
}

export function assessCheckIn(state: HotelState, reservationId: string): ActionOutcome {
  const checked = validateCheckIn(state, reservationId);
  if (!checked.ok) {
    return advise(state, `No. ${checked.message}`);
  }
  return advise(
    state,
    `Yes. ${guestName(state, checked.reservation.guestId)} can check in to room ${checked.room.number}, which is ${roomStatusLabel(checked.room.status)}.`,
  );
}

export function checkOut(state: HotelState, reservationId: string): ActionOutcome {
  const reservation = findReservation(state, reservationId);
  if (!reservation) return fail("not_found", `No reservation ${reservationId}.`);
  if (reservation.status !== "in_house") {
    return fail("invalid_status", `${reservation.id} is ${reservation.status.replaceAll("_", " ")} and is not in house.`);
  }
  const events: DomainEvent[] = [];
  let rooms = state.rooms;
  if (reservation.roomNumber) {
    const room = findRoom(state, reservation.roomNumber);
    if (room) {
      const dirty: Room = { ...room, status: "dirty" };
      rooms = replaceById(rooms, dirty);
      events.push({ type: "room.updated", room: dirty });
    }
  }
  const nextReservation: Reservation = { ...reservation, status: "checked_out" };
  events.unshift({ type: "reservation.upserted", reservation: nextReservation });
  const next = commit(state, {
    reservations: replaceById(state.reservations, nextReservation),
    rooms,
  });
  return success(
    next,
    `${guestName(state, reservation.guestId)} is checked out. Room ${reservation.roomNumber ?? "unassigned"} is dirty for housekeeping.`,
    events,
  );
}

export function assignRoom(
  state: HotelState,
  reservationId: string,
  roomNumber: string,
): ActionOutcome {
  const reservation = findReservation(state, reservationId);
  if (!reservation) return fail("not_found", `No reservation ${reservationId}.`);
  if (reservation.status !== "confirmed" && reservation.status !== "in_house") {
    return fail(
      "invalid_status",
      `${reservation.id} is ${reservation.status.replaceAll("_", " ")} and cannot take a room.`,
    );
  }
  const available = assertAssignable(state, roomNumber, reservation.id);
  if (!available.ok) return available;

  const events: DomainEvent[] = [];
  let rooms = state.rooms;
  if (
    reservation.status === "in_house" &&
    reservation.roomNumber &&
    reservation.roomNumber !== available.room.number
  ) {
    const previous = findRoom(state, reservation.roomNumber);
    if (previous) {
      const dirty: Room = { ...previous, status: "dirty" };
      rooms = replaceById(rooms, dirty);
      events.push({ type: "room.updated", room: dirty });
    }
  }

  const nextReservation: Reservation = { ...reservation, roomNumber: available.room.number };
  events.push({ type: "reservation.upserted", reservation: nextReservation });

  if (reservation.status === "in_house") {
    const occupied: Room = { ...available.room, status: "occupied" };
    rooms = replaceById(rooms, occupied);
    events.push({ type: "room.updated", room: occupied });
  }

  const next = commit(state, {
    reservations: replaceById(state.reservations, nextReservation),
    rooms,
  });
  const staying =
    reservation.status === "in_house"
      ? " The room is now occupied."
      : " The room stays unoccupied until check-in.";
  return success(
    next,
    `${reservation.id} is assigned to room ${available.room.number}.${staying}`,
    events,
  );
}

export function cancelReservation(state: HotelState, reservationId: string): ActionOutcome {
  const reservation = findReservation(state, reservationId);
  if (!reservation) return fail("not_found", `No reservation ${reservationId}.`);
  if (reservation.status !== "confirmed") {
    return fail(
      "invalid_status",
      `${reservation.id} is ${reservation.status.replaceAll("_", " ")}. Only a confirmed reservation can be cancelled.`,
    );
  }
  const nextReservation: Reservation = { ...reservation, status: "cancelled" };
  const next = commit(state, {
    reservations: replaceById(state.reservations, nextReservation),
  });
  return success(next, cancellationMessage(state, reservation, true), [
    { type: "reservation.upserted", reservation: nextReservation },
  ]);
}

export function assessCancellation(state: HotelState, reservationId: string): ActionOutcome {
  const reservation = findReservation(state, reservationId);
  if (!reservation) return advise(state, `No. No reservation ${reservationId}.`);
  if (reservation.status !== "confirmed") {
    return advise(
      state,
      `No. ${reservation.id} is ${reservation.status.replaceAll("_", " ")} and is not a confirmed stay that can be cancelled.`,
    );
  }
  return advise(state, cancellationMessage(state, reservation, false));
}

export function createReservation(
  state: HotelState,
  command: Extract<Command, { name: "create_reservation" }>,
): ActionOutcome {
  const guestNameInput = (command.guestName ?? "").trim();
  if (!guestNameInput) return fail("bad_request", "A guest name is required.");
  if (!isIsoDate(command.arrival) || !isIsoDate(command.departure)) {
    return fail("invalid_dates", "Arrival and departure must be YYYY-MM-DD dates.");
  }
  if (command.arrival < state.businessDate) {
    return fail("invalid_dates", "Arrival cannot be before the business date.");
  }
  if (command.departure <= command.arrival) {
    return fail("invalid_dates", "Departure has to be after arrival.");
  }

  const events: DomainEvent[] = [];
  let guests = state.guests;
  let nextGuest = state.nextGuest;
  let guest = state.guests.find((item) => item.name.toLowerCase() === guestNameInput.toLowerCase());
  if (!guest) {
    guest = makeGuest(nextGuest, guestNameInput);
    nextGuest += 1;
    guests = [...guests, guest];
    events.push({ type: "guest.upserted", guest });
  }

  let roomNumber: string | null = null;
  if (command.roomNumber) {
    const available = assertAssignable(state, command.roomNumber, "");
    if (!available.ok) return available;
    roomNumber = available.room.number;
  }

  const reservation: Reservation = {
    id: `LH-${state.nextReservation}`,
    guestId: guest.id,
    roomNumber,
    status: "confirmed",
    arrival: command.arrival,
    departure: command.departure,
    adults: command.adults && command.adults > 0 ? command.adults : 1,
    ratePlan: "Harbor Flexible",
    notes: "",
    balanceCents: 0,
  };
  events.push({ type: "reservation.upserted", reservation });
  const next = commit(state, {
    guests,
    nextGuest,
    nextReservation: state.nextReservation + 1,
    reservations: [reservation, ...state.reservations],
  });
  const roomText = roomNumber ? ` in room ${roomNumber}` : " with no room assigned yet";
  return success(next, `${reservation.id} is confirmed for ${guest.name}${roomText}.`, events);
}

export function logStaffRequest(
  state: HotelState,
  kind: string,
  summary: string,
  roomNumber?: string,
): ActionOutcome {
  const cleanSummary = summary.trim();
  if (!cleanSummary) return fail("bad_request", "A request needs a short summary.");
  if (!isRequestKind(kind)) return fail("bad_request", "Request kind must be housekeeping, maintenance, amenity, or front desk.");
  let resolvedRoom: string | null = null;
  if (roomNumber) {
    const room = findRoom(state, roomNumber);
    if (!room) return fail("not_found", `Room ${roomNumber} is not on the board.`);
    resolvedRoom = room.number;
  }
  const request: StaffRequest = {
    id: `SR-${state.nextRequest}`,
    kind,
    status: "open",
    roomNumber: resolvedRoom,
    guestId: null,
    summary: cleanSummary,
    createdAt: state.businessDate,
  };
  const next = commit(state, {
    nextRequest: state.nextRequest + 1,
    staffRequests: [request, ...state.staffRequests],
  });
  return success(next, `${request.id} is open${resolvedRoom ? ` for room ${resolvedRoom}` : ""}.`, [
    { type: "staff_request.upserted", request },
  ]);
}

export function advanceStaffRequest(state: HotelState, requestId: string): ActionOutcome {
  const request = state.staffRequests.find((item) => item.id.toLowerCase() === requestId.toLowerCase());
  if (!request) return fail("not_found", `No staff request ${requestId}.`);
  if (request.status === "done") return fail("already_done", `${request.id} is already done.`);
  const status = request.status === "open" ? "in_progress" : "done";
  const nextRequest: StaffRequest = { ...request, status };
  const next = commit(state, {
    staffRequests: replaceById(state.staffRequests, nextRequest),
  });
  const verb = status === "in_progress" ? "in progress" : "done";
  return success(next, `${request.id} is ${verb}.`, [
    { type: "staff_request.upserted", request: nextRequest },
  ]);
}

function validateCheckIn(
  state: HotelState,
  reservationId: string,
): { ok: true; reservation: Reservation; room: Room } | ActionFailure {
  const reservation = findReservation(state, reservationId);
  if (!reservation) return fail("not_found", `No reservation ${reservationId}.`);
  if (reservation.status === "in_house") return fail("invalid_status", `${reservation.id} is already in house.`);
  if (reservation.status !== "confirmed") {
    return fail(
      "invalid_status",
      `${reservation.id} is ${reservation.status.replaceAll("_", " ")} and cannot be checked in.`,
    );
  }
  if (reservation.arrival !== state.businessDate) {
    return fail(
      "invalid_status",
      `${reservation.id} arrives ${reservation.arrival}. Check-in is only for the business date.`,
    );
  }
  if (!reservation.roomNumber) {
    return fail("room_not_assigned", `${reservation.id} has no room assigned. Assign a clean room before check-in.`);
  }
  const room = findRoom(state, reservation.roomNumber);
  if (!room) return fail("not_found", `Room ${reservation.roomNumber} is not on the board.`);
  if (!roomReady(room.status)) {
    return fail(
      "room_not_ready",
      `Room ${room.number} is ${roomStatusLabel(room.status)}. It has to be vacant or inspected before check-in.`,
    );
  }
  return { ok: true, reservation, room };
}

function assertAssignable(
  state: HotelState,
  roomNumber: string,
  ignoringReservationId: string,
): { ok: true; room: Room } | ActionFailure {
  const room = findRoom(state, roomNumber);
  if (!room) return fail("not_found", `Room ${roomNumber} is not on the board.`);
  if (room.status === "out_of_order") {
    return fail("room_unavailable", `Room ${room.number} is out of order and cannot be assigned.`);
  }
  if (room.status === "occupied") {
    return fail("room_unavailable", `Room ${room.number} is occupied.`);
  }
  if (room.status === "dirty") {
    return fail("room_not_ready", `Room ${room.number} is dirty. Housekeeping has to release it first.`);
  }
  const holder = state.reservations.find(
    (reservation) =>
      reservation.roomNumber === room.number &&
      reservation.id !== ignoringReservationId &&
      (reservation.status === "confirmed" || reservation.status === "in_house"),
  );
  if (holder) {
    return fail("room_unavailable", `Room ${room.number} is held for ${holder.id}.`);
  }
  return { ok: true, room };
}

function cancellationMessage(state: HotelState, reservation: Reservation, executed: boolean): string {
  const lead = nightsBetween(state.businessDate, reservation.arrival);
  const name = guestName(state, reservation.guestId);
  if (lead >= 2) {
    return executed
      ? `${reservation.id} for ${name} is cancelled with no fee. Arrival is ${lead} nights out.`
      : `Yes. ${reservation.id} for ${name} can be cancelled with no fee. Arrival is ${lead} nights out, which is inside the fee-free window.`;
  }
  return executed
    ? `${reservation.id} for ${name} is cancelled. The first night is forfeited because arrival is ${lead === 0 ? "today" : "tomorrow"}.`
    : `No. ${reservation.id} for ${name} is inside the fee window. Cancelling forfeits the first night because arrival is ${lead === 0 ? "today" : "tomorrow"}.`;
}

function makeGuest(sequence: number, name: string): Guest {
  const handle = name.toLowerCase().replace(/[^a-z]+/g, ".").replace(/^\.|\.$/g, "");
  return {
    id: `g-${sequence}`,
    name,
    email: `${handle || "guest"}@guests.lumen-harbor.example`,
    phone: "",
    loyaltyTier: "member",
    notes: "Added from the desk.",
  };
}

function isRequestKind(value: string): value is RequestKind {
  return value === "housekeeping" || value === "maintenance" || value === "amenity" || value === "front_desk";
}

function isIsoDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`));
}

function findReservation(state: HotelState, id: string): Reservation | undefined {
  return state.reservations.find((reservation) => reservation.id.toLowerCase() === id.toLowerCase());
}

function findRoom(state: HotelState, number: string): Room | undefined {
  return state.rooms.find((room) => room.number === number);
}

function replaceById<T extends { id: string }>(items: T[], next: T): T[] {
  return items.map((item) => (item.id === next.id ? next : item));
}

function commit(state: HotelState, patch: Partial<HotelState>): HotelState {
  return { ...state, ...patch, revision: state.revision + 1 };
}

function success(state: HotelState, message: string, events: DomainEvent[]): ActionSuccess {
  return { ok: true, changed: true, message, state, events };
}

function advise(state: HotelState, message: string): ActionSuccess {
  return { ok: true, changed: false, message, state, events: [] };
}

function fail(code: string, message: string): ActionFailure {
  return { ok: false, code, message };
}
