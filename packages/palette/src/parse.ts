import type { Command, RequestKind } from "@lumen/domain";

interface Found {
  index: number;
  command: Command;
}

export function parseAction(input: string): Command | null {
  const query = input.trim();
  const found: Found[] = [];
  const consider = (match: RegExpMatchArray | null, command: Command | null) => {
    if (match && command) found.push({ index: match.index ?? 0, command });
  };

  const checkOut = query.match(/\bcheck[\s-]?out\b(?:\s+reservation)?\s+(LH-\d+)/i);
  if (checkOut?.[1]) consider(checkOut, { name: "check_out", reservationId: checkOut[1].toUpperCase() });

  const checkIn = query.match(/\bcheck[\s-]?in\b(?:\s+reservation)?\s+(LH-\d+)/i);
  if (checkIn?.[1]) consider(checkIn, { name: "check_in", reservationId: checkIn[1].toUpperCase() });

  const assignRoomFirst = query.match(/\bassign\b(?:\s+room)?\s+(\d{3})\s+to\s+(LH-\d+)/i);
  if (assignRoomFirst?.[1] && assignRoomFirst[2]) {
    consider(assignRoomFirst, {
      name: "assign_room",
      roomNumber: assignRoomFirst[1],
      reservationId: assignRoomFirst[2].toUpperCase(),
    });
  }

  const assignStayFirst = query.match(/\bassign\b(?:\s+reservation)?\s+(LH-\d+)\s+to\s+(?:room\s+)?(\d{3})/i);
  if (assignStayFirst?.[1] && assignStayFirst[2]) {
    consider(assignStayFirst, {
      name: "assign_room",
      reservationId: assignStayFirst[1].toUpperCase(),
      roomNumber: assignStayFirst[2],
    });
  }

  const cancel = query.match(/\bcancel\b(?:\s+(?:the\s+)?(?:reservation|booking))?\s+(LH-\d+)/i);
  if (cancel?.[1]) consider(cancel, { name: "cancel_reservation", reservationId: cancel[1].toUpperCase() });

  const advance = query.match(/\b(?:complete|advance|finish)\b(?:\s+staff)?\s+request\s+(SR-\d+)/i);
  if (advance?.[1]) consider(advance, { name: "advance_staff_request", requestId: advance[1].toUpperCase() });

  const logged = query.match(
    /\blog\b\s+(housekeeping|maintenance|amenity|front desk|front-desk)\s+request(?:\s+for)?(?:\s+room\s+(\d{3}))?\s*[:-]\s*(.+)$/i,
  );
  if (logged?.[1] && logged[3]) {
    consider(logged, {
      name: "log_staff_request",
      kind: normalizeKind(logged[1]),
      roomNumber: logged[2],
      summary: logged[3].trim(),
    });
  }

  const booked = query.match(
    /\b(?:book|create(?:\s+a)?\s+reservation(?:\s+for)?|new reservation for)\s+([a-z][a-z' .-]+?)\s+(?:from|arriving)\s+(\d{4}-\d{2}-\d{2})\s+(?:to|until|departing)\s+(\d{4}-\d{2}-\d{2})/i,
  );
  if (booked?.[1] && booked[2] && booked[3]) {
    consider(booked, {
      name: "create_reservation",
      guestName: booked[1].trim(),
      arrival: booked[2],
      departure: booked[3],
    });
  }

  found.sort((a, b) => a.index - b.index);
  return found[0]?.command ?? null;
}

function normalizeKind(value: string): RequestKind {
  const kind = value.toLowerCase().replace(/\s+/g, " ");
  if (kind === "maintenance") return "maintenance";
  if (kind === "amenity") return "amenity";
  if (kind === "front desk" || kind === "front-desk") return "front_desk";
  return "housekeeping";
}
