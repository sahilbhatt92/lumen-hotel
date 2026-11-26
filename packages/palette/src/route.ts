import type { Command, DeskSection, SearchKind } from "@lumen/domain";
import { parseAction } from "./parse.js";

export type PaletteTarget = "search" | "actions" | "docs";

export type PaletteIntent = "find" | "operate" | "policy" | "operate_and_policy";

export interface PaletteRoute {
  target: PaletteTarget;
  intent: PaletteIntent;
  execute: boolean;
  action: Command | null;
}

export function routePaletteQuery(input: string): PaletteRoute {
  const query = input.trim();
  const action = parseAction(query);
  const imperative = isImperative(query);
  const policy = mentionsPolicy(query);
  const question = isQuestion(query);

  if (question && isLookupQuestion(query) && !policy && !action) {
    return { target: "search", intent: "find", execute: false, action: null };
  }

  if (action && imperative && (policy || asksExplanation(query))) {
    return { target: "docs", intent: "operate_and_policy", execute: true, action };
  }

  if (action && question && !imperative) {
    return { target: "docs", intent: "operate_and_policy", execute: false, action };
  }

  if (action) {
    return { target: "actions", intent: "operate", execute: true, action };
  }

  if (policy || (question && !isLookupQuestion(query))) {
    return { target: "docs", intent: "policy", execute: false, action: null };
  }

  return { target: "search", intent: "find", execute: false, action: null };
}

export function sectionForHit(kind: SearchKind): DeskSection {
  switch (kind) {
    case "room":
      return "rooms";
    case "reservation":
      return "reservations";
    case "guest":
      return "guests";
    case "staff_request":
      return "requests";
  }
}

function isQuestion(query: string): boolean {
  return /\?\s*$/.test(query) || /^(what|why|how|when|who|can|could|should|does|do|is|are|will)\b/i.test(query);
}

function isImperative(query: string): boolean {
  if (/\?\s*$/.test(query)) return false;
  return /^(please\s+)?(check[\s-]?in|check[\s-]?out|assign|cancel|log|book|create|new reservation|complete|advance|finish)\b/i.test(
    query,
  );
}

function isLookupQuestion(query: string): boolean {
  return /^(who|where|which|show|find|list)\b/i.test(query) || /\b(who is|where is|which room|show me)\b/i.test(query);
}

function mentionsPolicy(query: string): boolean {
  return (
    /\b(policy|policies|sop|procedure|standard|rule|allowed|identification|deposit|cancellation|fee)\b/i.test(query) ||
    /\blate checkout\b/i.test(query)
  );
}

function asksExplanation(query: string): boolean {
  return /\b(explain|why|whether|quote)\b/i.test(query);
}
