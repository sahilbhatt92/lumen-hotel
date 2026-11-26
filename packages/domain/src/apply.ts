import type { DomainEvent, HotelState } from "./types.js";

export function applyEvent(state: HotelState, event: DomainEvent): HotelState {
  switch (event.type) {
    case "reservation.upserted":
      return {
        ...state,
        reservations: upsert(state.reservations, event.reservation),
      };
    case "room.updated":
      return {
        ...state,
        rooms: state.rooms.map((room) => (room.id === event.room.id ? event.room : room)),
      };
    case "guest.upserted":
      return {
        ...state,
        guests: upsert(state.guests, event.guest),
      };
    case "staff_request.upserted":
      return {
        ...state,
        staffRequests: upsert(state.staffRequests, event.request),
      };
    default:
      return state;
  }
}

export function touchedIds(event: DomainEvent): string[] {
  switch (event.type) {
    case "reservation.upserted":
      return [event.reservation.id];
    case "room.updated":
      return [event.room.id, event.room.number];
    case "guest.upserted":
      return [event.guest.id];
    case "staff_request.upserted":
      return [event.request.id];
    default:
      return [];
  }
}

function upsert<T extends { id: string }>(items: T[], next: T): T[] {
  const index = items.findIndex((item) => item.id === next.id);
  if (index === -1) return [next, ...items];
  return items.map((item) => (item.id === next.id ? next : item));
}
