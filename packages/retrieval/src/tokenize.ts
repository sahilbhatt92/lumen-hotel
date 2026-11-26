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
  "is",
  "our",
  "we",
  "with",
  "by",
  "from",
  "that",
  "this",
  "it",
  "be",
  "as",
  "are",
  "if",
  "when",
  "how",
  "what",
  "do",
  "does",
  "can",
  "a",
]);

export function tokenize(value: string): string[] {
  return value
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((term) => term.length > 1 && !STOP.has(term));
}
