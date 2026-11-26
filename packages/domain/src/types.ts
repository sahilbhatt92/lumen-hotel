export const BUSINESS_DATE = "2026-11-26";

export type DeskSection = "today" | "rooms" | "reservations" | "guests" | "requests";

export type RoomStatus = "vacant" | "occupied" | "dirty" | "inspected" | "out_of_order";

export type RoomType = "courtyard" | "harbor" | "loft";

export type ReservationStatus =
  | "confirmed"
  | "in_house"
  | "checked_out"
  | "cancelled"
  | "no_show";

export type LoyaltyTier = "member" | "harbor" | "lumen";

export type RequestKind = "housekeeping" | "maintenance" | "amenity" | "front_desk";

export type RequestStatus = "open" | "in_progress" | "done";

export interface Property {
  id: string;
  name: string;
  city: string;
  address: string;
}

export interface Room {
  id: string;
  number: string;
  floor: number;
  type: RoomType;
  status: RoomStatus;
  features: string[];
}

export interface Guest {
  id: string;
  name: string;
  email: string;
  phone: string;
  loyaltyTier: LoyaltyTier;
  notes: string;
}

export interface Reservation {
  id: string;
  guestId: string;
  roomNumber: string | null;
  status: ReservationStatus;
  arrival: string;
  departure: string;
  adults: number;
  ratePlan: string;
  notes: string;
  balanceCents: number;
}

export interface StaffRequest {
  id: string;
  kind: RequestKind;
  status: RequestStatus;
  roomNumber: string | null;
  guestId: string | null;
  summary: string;
  createdAt: string;
}

export interface HotelState {
  businessDate: string;
  revision: number;
  nextReservation: number;
  nextRequest: number;
  nextGuest: number;
  property: Property;
  rooms: Room[];
  guests: Guest[];
  reservations: Reservation[];
  staffRequests: StaffRequest[];
}

export type DomainEvent =
  | { type: "reservation.upserted"; reservation: Reservation }
  | { type: "room.updated"; room: Room }
  | { type: "guest.upserted"; guest: Guest }
  | { type: "staff_request.upserted"; request: StaffRequest };

export type Command =
  | { name: "check_in"; reservationId: string }
  | { name: "check_out"; reservationId: string }
  | { name: "assign_room"; reservationId: string; roomNumber: string }
  | { name: "cancel_reservation"; reservationId: string }
  | { name: "assess_check_in"; reservationId: string }
  | { name: "assess_cancellation"; reservationId: string }
  | {
      name: "create_reservation";
      guestName: string;
      arrival: string;
      departure: string;
      roomNumber?: string;
      adults?: number;
    }
  | {
      name: "log_staff_request";
      kind: RequestKind;
      summary: string;
      roomNumber?: string;
    }
  | { name: "advance_staff_request"; requestId: string };

export interface ActionSuccess {
  ok: true;
  changed: boolean;
  message: string;
  state: HotelState;
  events: DomainEvent[];
}

export interface ActionFailure {
  ok: false;
  message: string;
  code: string;
}

export type ActionOutcome = ActionSuccess | ActionFailure;

export type SearchKind = "room" | "reservation" | "guest" | "staff_request";

export interface SearchHit {
  kind: SearchKind;
  id: string;
  title: string;
  subtitle: string;
  score: number;
}

export interface SearchResponse {
  businessDate: string;
  query: string;
  hits: SearchHit[];
}
