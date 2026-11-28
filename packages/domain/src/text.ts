import type { HotelState, RequestKind, Reservation, RoomStatus } from "./types.js";

export function roomStatusLabel(status: RoomStatus): string {
  if (status === "out_of_order") return "out of order";
  return status;
}

export function requestKindLabel(kind: RequestKind): string {
  if (kind === "front_desk") return "front desk";
  return kind;
}

export function guestName(state: HotelState, guestId: string): string {
  return state.guests.find((guest) => guest.id === guestId)?.name ?? "Unknown guest";
}

export function nightsBetween(start: string, end: string): number {
  const from = Date.parse(`${start}T00:00:00Z`);
  const to = Date.parse(`${end}T00:00:00Z`);
  return Math.round((to - from) / 86_400_000);
}

export function formatLongDate(iso: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  }).format(new Date(`${iso}T00:00:00Z`));
}

export function formatMoney(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(cents / 100);
}

export function roomReady(status: RoomStatus): boolean {
  return status === "vacant" || status === "inspected";
}

export function summarizeDay(state: HotelState): string {
  const arrivals = state.reservations.filter(
    (reservation) =>
      reservation.status === "confirmed" && reservation.arrival === state.businessDate,
  );
  const waiting = arrivals.filter((reservation) => !arrivalReady(state, reservation));
  const departures = state.reservations.filter(
    (reservation) =>
      reservation.status === "in_house" && reservation.departure === state.businessDate,
  );
  const open = state.staffRequests.filter((request) => request.status !== "done").length;
  const arrivalText =
    arrivals.length === 0
      ? "No confirmed arrivals remain today."
      : `${arrivals.length} confirmed ${arrivals.length === 1 ? "arrival" : "arrivals"} today.`;
  const waitingText =
    waiting.length === 0
      ? "Every arrival has a clean room."
      : `${waiting.length} still ${waiting.length === 1 ? "needs" : "need"} a clean assigned room.`;
  const departureText =
    departures.length === 0
      ? "No departures left on the board."
      : `${departures.length} ${departures.length === 1 ? "departure" : "departures"} due.`;
  const requestText = `${open} staff ${open === 1 ? "request" : "requests"} still open.`;
  return `${arrivalText} ${waitingText} ${departureText} ${requestText}`;
}

function arrivalReady(state: HotelState, reservation: Reservation): boolean {
  if (!reservation.roomNumber) return false;
  const room = state.rooms.find((item) => item.number === reservation.roomNumber);
  return Boolean(room && roomReady(room.status));
}
