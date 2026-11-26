import type { HotelState, SearchHit, SearchResponse } from "./types.js";
import { guestName, requestKindLabel, roomStatusLabel } from "./text.js";

const STOP = new Set([
  "a",
  "an",
  "the",
  "of",
  "to",
  "and",
  "or",
  "for",
  "in",
  "on",
  "at",
  "please",
  "me",
  "show",
  "find",
  "is",
  "who",
  "where",
  "room",
  "rooms",
]);

export function searchOperations(state: HotelState, rawQuery: string): SearchResponse {
  const query = rawQuery.trim();
  const terms = tokenize(query);
  const hits: SearchHit[] = [];

  for (const room of state.rooms) {
    const title = `Room ${room.number}`;
    const subtitle = `${room.type} · ${roomStatusLabel(room.status)} · ${room.features.join(", ")}`;
    let score = scoreText(query, terms, [room.number, room.id, title, subtitle, room.status, room.type]);
    if (terms.includes(room.number)) score += 100;
    hits.push({
      kind: "room",
      id: room.id,
      title,
      subtitle,
      score,
    });
  }

  for (const reservation of state.reservations) {
    const name = guestName(state, reservation.guestId);
    const title = `${reservation.id} · ${name}`;
    const subtitle = `${reservation.status.replaceAll("_", " ")} · ${reservation.arrival} to ${reservation.departure} · room ${reservation.roomNumber ?? "unassigned"}`;
    let score = scoreText(query, terms, [
      reservation.id,
      name,
      title,
      subtitle,
      reservation.status,
      reservation.roomNumber ?? "",
      reservation.ratePlan,
      reservation.notes,
    ]);
    if (terms.includes("arrival") || terms.includes("arrivals")) {
      if (reservation.status === "confirmed" && reservation.arrival === state.businessDate) score += 40;
    }
    if (terms.includes("departure") || terms.includes("departures")) {
      if (reservation.status === "in_house" && reservation.departure === state.businessDate) score += 40;
    }
    if (terms.includes("inhouse") || (terms.includes("house") && terms.includes("in"))) {
      if (reservation.status === "in_house") score += 24;
    }
    hits.push({ kind: "reservation", id: reservation.id, title, subtitle, score });
  }

  for (const guest of state.guests) {
    const title = guest.name;
    const subtitle = `${guest.loyaltyTier} · ${guest.email}`;
    hits.push({
      kind: "guest",
      id: guest.id,
      title,
      subtitle,
      score: scoreText(query, terms, [guest.name, guest.email, guest.id, subtitle, guest.notes, guest.loyaltyTier]),
    });
  }

  for (const request of state.staffRequests) {
    const title = `${request.id} · ${request.summary}`;
    const subtitle = `${requestKindLabel(request.kind)} · ${request.status.replaceAll("_", " ")} · room ${request.roomNumber ?? "none"}`;
    hits.push({
      kind: "staff_request",
      id: request.id,
      title,
      subtitle,
      score: scoreText(query, terms, [request.id, request.summary, subtitle, request.kind, request.status]),
    });
  }

  if (terms.includes("dirty")) {
    for (const hit of hits) {
      if (hit.kind === "room" && hit.subtitle.includes("dirty")) hit.score += 36;
    }
  }

  return {
    businessDate: state.businessDate,
    query,
    hits: hits
      .filter((hit) => hit.score > 0)
      .sort((a, b) => b.score - a.score || a.title.localeCompare(b.title))
      .slice(0, 12),
  };
}

function scoreText(query: string, terms: string[], fields: string[]): number {
  if (!query) return 0;
  const haystack = fields.join(" ").toLowerCase();
  let score = 0;
  const normalized = query.toLowerCase();
  if (fields.some((field) => field.toLowerCase() === normalized)) score += 120;
  for (const field of fields) {
    if (field && normalized.includes(field.toLowerCase()) && field.length > 2) score += 30;
  }
  for (const term of terms) {
    if (haystack.includes(term)) score += term.length > 3 ? 8 : 14;
  }
  return score;
}

function tokenize(value: string): string[] {
  return value
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((term) => term && !STOP.has(term));
}
