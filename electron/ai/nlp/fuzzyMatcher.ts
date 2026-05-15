/**
 * Fuzzy Matcher — Phase 7
 *
 * Lightweight string similarity functions for matching user input
 * against app alias table entries — no external dependencies.
 *
 * Used as the last-resort resolver in nlpRouter when exact/prefix/
 * substring matches all fail (e.g. for typos like "chorme", "spottify").
 */

import { safeLogger } from '../../main/safeLogger.js'
import { ALIAS_TO_KEY } from './aliases.js'

// ─── String distance ──────────────────────────────────────────────────────────

/** Classic Levenshtein edit distance (operations: insert, delete, substitute). */
export function levenshtein(a: string, b: string): number {
  if (a === b) return 0
  if (a.length === 0) return b.length
  if (b.length === 0) return a.length

  const m = a.length
  const n = b.length
  // Use two rows to save memory
  let prev = Array.from({ length: n + 1 }, (_, i) => i)
  let curr = new Array<number>(n + 1).fill(0)

  for (let i = 1; i <= m; i++) {
    curr[0] = i
    for (let j = 1; j <= n; j++) {
      curr[j] = a[i - 1] === b[j - 1]
        ? prev[j - 1]
        : 1 + Math.min(prev[j - 1], prev[j], curr[j - 1])
    }
    ;[prev, curr] = [curr, prev]
  }

  return prev[n]
}

/**
 * Normalized string similarity: 1.0 = identical, 0.0 = completely different.
 * Based on Levenshtein distance relative to the length of the longer string.
 */
export function stringSimilarity(a: string, b: string): number {
  if (a === b) return 1
  const maxLen = Math.max(a.length, b.length)
  if (maxLen === 0) return 1
  return 1 - levenshtein(a, b) / maxLen
}

// ─── Token-level similarity ───────────────────────────────────────────────────

/** Split a string into lowercase word tokens. */
function tokenize(s: string): string[] {
  return s.toLowerCase().split(/\s+/).filter(Boolean)
}

/**
 * Fraction of tokens in `query` that appear in `target` (or vice-versa),
 * scaled to [0, 1].
 */
export function tokenOverlapScore(query: string, target: string): number {
  const qt = tokenize(query)
  const tt = new Set(tokenize(target))
  if (qt.length === 0 || tt.size === 0) return 0

  let matches = 0
  for (const t of qt) {
    if (tt.has(t)) matches++
  }

  return matches / Math.max(qt.length, tt.size)
}

// ─── Per-token fuzzy score ────────────────────────────────────────────────────

/**
 * For short words (≤8 chars), apply single-token fuzzy matching.
 * Each query token is compared against each alias token; best pair scores.
 */
function tokenFuzzyScore(query: string, alias: string): number {
  const qt = tokenize(query)
  const at = tokenize(alias)
  if (qt.length === 0 || at.length === 0) return 0

  let totalScore = 0
  for (const q of qt) {
    let best = 0
    for (const a of at) {
      // Only fuzzy-compare reasonably short tokens to avoid false positives
      if (q.length >= 3 && a.length >= 3) {
        best = Math.max(best, stringSimilarity(q, a))
      }
    }
    totalScore += best
  }

  return totalScore / qt.length
}

// ─── Combined score ───────────────────────────────────────────────────────────

/**
 * Combined score using overlap + per-token fuzzy.
 * Returns a value in [0, 1].
 */
export function combinedScore(query: string, alias: string): number {
  const overlap = tokenOverlapScore(query, alias)
  const fuzzy   = tokenFuzzyScore(query, alias)
  // Weight: overlap is precise, fuzzy catches typos
  return Math.max(overlap, fuzzy * 0.85)
}

// ─── App alias fuzzy lookup ───────────────────────────────────────────────────

export interface FuzzyMatch {
  key:   string
  alias: string
  score: number
}

/**
 * Find the best-matching appKey for a natural-language phrase via fuzzy scoring.
 * Returns null if no alias scores above `threshold` (default 0.6).
 *
 * Only searches aliases with ≥ 3 chars to avoid spurious matches.
 */
export function fuzzyMatchAppKey(phrase: string, threshold = 0.60): FuzzyMatch | null {
  const p = phrase.trim().toLowerCase()
  if (p.length < 4) return null   // never fuzzy-match "hi", "ok", etc.

  let best: FuzzyMatch | null = null

  for (const [alias, key] of ALIAS_TO_KEY) {
    if (alias.length < 3) continue

    const score = combinedScore(p, alias)
    if (score >= threshold && (!best || score > best.score)) {
      best = { key, alias, score }
    }
  }

  if (best) {
    safeLogger.info(
      `[JARVIS_NLP] fuzzy match — "${p}" → alias="${best.alias}" key="${best.key}" score=${best.score.toFixed(2)}`,
    )
  }

  return best
}

/**
 * Return top-N fuzzy matches sorted by score descending.
 * Useful for presenting clarification choices to the user.
 */
export function topFuzzyMatches(phrase: string, topN = 3, threshold = 0.50): FuzzyMatch[] {
  const p = phrase.trim().toLowerCase()
  if (p.length < 4) return []
  const results: FuzzyMatch[] = []

  for (const [alias, key] of ALIAS_TO_KEY) {
    if (alias.length < 3) continue
    const score = combinedScore(p, alias)
    if (score >= threshold) {
      results.push({ key, alias, score })
    }
  }

  // Deduplicate by key, keeping max score per key
  const best = new Map<string, FuzzyMatch>()
  for (const r of results) {
    const existing = best.get(r.key)
    if (!existing || r.score > existing.score) {
      best.set(r.key, r)
    }
  }

  return [...best.values()]
    .sort((a, b) => b.score - a.score)
    .slice(0, topN)
}
