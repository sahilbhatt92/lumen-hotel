import type { Chunk } from "./chunk.js";
import { tokenize } from "./tokenize.js";

interface Indexed {
  chunk: Chunk;
  tf: Map<string, number>;
  length: number;
}

export interface ScoredChunk {
  chunk: Chunk;
  score: number;
}

export class Bm25Index {
  private readonly docs: Indexed[];
  private readonly df = new Map<string, number>();
  private readonly avgdl: number;

  constructor(
    chunks: Chunk[],
    private readonly k1 = 1.2,
    private readonly b = 0.75,
  ) {
    this.docs = chunks.map((chunk) => {
      const tokens = tokenize(`${chunk.title} ${chunk.heading} ${chunk.heading} ${chunk.text}`);
      const tf = new Map<string, number>();
      for (const token of tokens) tf.set(token, (tf.get(token) ?? 0) + 1);
      return { chunk, tf, length: tokens.length || 1 };
    });
    for (const doc of this.docs) {
      for (const term of doc.tf.keys()) this.df.set(term, (this.df.get(term) ?? 0) + 1);
    }
    const total = this.docs.reduce((sum, doc) => sum + doc.length, 0);
    this.avgdl = this.docs.length ? total / this.docs.length : 1;
  }

  search(query: string, limit = 4): ScoredChunk[] {
    const terms = [...new Set(tokenize(query))];
    const totalDocs = this.docs.length;
    if (!terms.length || !totalDocs) return [];
    return this.docs
      .map((doc) => {
        const raw = this.score(doc, terms, totalDocs);
        const score = doc.chunk.heading === "Overview" ? raw * 0.35 : raw;
        return { chunk: doc.chunk, score };
      })
      .filter((hit) => hit.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }

  private score(doc: Indexed, terms: string[], totalDocs: number): number {
    let score = 0;
    for (const term of terms) {
      const frequency = doc.tf.get(term) ?? 0;
      if (!frequency) continue;
      const docsWithTerm = this.df.get(term) ?? 0;
      const idf = Math.log((totalDocs - docsWithTerm + 0.5) / (docsWithTerm + 0.5) + 1);
      const denominator = frequency + this.k1 * (1 - this.b + this.b * (doc.length / this.avgdl));
      score += idf * ((frequency * (this.k1 + 1)) / denominator);
    }
    return score;
  }
}

export function selectSentences(text: string, query: string, count: number): string {
  const sentences = text
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
  if (!sentences.length) return "";
  const wanted = new Set(tokenize(query));
  const ranked = sentences
    .map((sentence) => ({
      sentence,
      overlap: tokenize(sentence).filter((token) => wanted.has(token)).length,
    }))
    .sort((a, b) => b.overlap - a.overlap);
  const picked = new Set(
    (ranked.some((item) => item.overlap > 0) ? ranked.filter((item) => item.overlap > 0) : ranked)
      .slice(0, count)
      .map((item) => item.sentence),
  );
  return sentences.filter((sentence) => picked.has(sentence)).slice(0, count).join(" ");
}
