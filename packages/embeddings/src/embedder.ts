import { createHash } from "node:crypto";
import { normalizeText } from "@jobagent/shared";

/**
 * Embedder — provider-agnostic interface (ADR-007). Swap LocalHashEmbedder for a real model
 * (e.g. Voyage/OpenAI) by implementing `embed`; the rest of the pipeline is unchanged.
 */
export interface Embedder {
  readonly dim: number;
  embed(texts: string[]): Promise<number[][]>;
}

/**
 * LocalHashEmbedder — deterministic, offline, zero-cost feature-hashing embedder.
 * Honest caveat: this captures **lexical overlap**, not deep semantics. It exists so the
 * pgvector pipeline (store + ANN search + blended scoring) runs end-to-end without an API
 * key or spend. Replace with a real embedding model for true semantic matching.
 */
export class LocalHashEmbedder implements Embedder {
  constructor(public readonly dim: number = 1536) {}

  async embed(texts: string[]): Promise<number[][]> {
    return texts.map((t) => this.embedOne(t));
  }

  private embedOne(text: string): number[] {
    const vec = new Array<number>(this.dim).fill(0);
    const tokens = tokenize(text);
    for (const tok of tokens) {
      const idx = hashToIndex(tok, this.dim);
      vec[idx] = (vec[idx] ?? 0) + hashSign(tok);
    }
    // also hash bigrams for a little context sensitivity
    for (let i = 0; i + 1 < tokens.length; i++) {
      const bg = `${tokens[i]}_${tokens[i + 1]}`;
      const idx = hashToIndex(bg, this.dim);
      vec[idx] = (vec[idx] ?? 0) + hashSign(bg) * 0.5;
    }
    return l2normalize(vec);
  }
}

export function tokenize(text: string): string[] {
  const norm = normalizeText(text);
  return norm ? norm.split(" ").filter((t) => t.length >= 2) : [];
}

export function l2normalize(vec: number[]): number[] {
  let sum = 0;
  for (const v of vec) sum += v * v;
  const norm = Math.sqrt(sum);
  if (norm === 0) return vec;
  return vec.map((v) => v / norm);
}

export function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0;
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) dot += a[i]! * b[i]!;
  return dot; // inputs are L2-normalized, so dot == cosine
}

/** Serialize a vector to pgvector's text input form: "[0.1,0.2,...]". */
export function toPgVector(vec: number[]): string {
  return `[${vec.join(",")}]`;
}

function hashToIndex(token: string, dim: number): number {
  const h = createHash("md5").update(token).digest();
  // first 4 bytes → uint32 → mod dim
  const n = (h[0]! << 24) | (h[1]! << 16) | (h[2]! << 8) | h[3]!;
  return Math.abs(n) % dim;
}

function hashSign(token: string): 1 | -1 {
  const h = createHash("md5").update(`sign:${token}`).digest();
  return (h[0]! & 1) === 0 ? 1 : -1;
}
