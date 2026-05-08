const EMBEDDING_SIZE = 64

export function createLocalEmbedding(text: string): number[] {
  const vector = Array.from<number>({ length: EMBEDDING_SIZE }).fill(0)
  const normalized = text.toLowerCase().replace(/\s+/g, ' ').trim()
  for (let index = 0; index < normalized.length; index += 1) {
    const code = normalized.charCodeAt(index)
    vector[index % EMBEDDING_SIZE] += code / 255
  }
  return normalizeVector(vector)
}

export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0
  let dot = 0
  let aNorm = 0
  let bNorm = 0
  for (let i = 0; i < a.length; i += 1) {
    dot += a[i] * b[i]
    aNorm += a[i] ** 2
    bNorm += b[i] ** 2
  }
  const denominator = Math.sqrt(aNorm) * Math.sqrt(bNorm)
  if (denominator === 0) return 0
  return dot / denominator
}

function normalizeVector(vector: number[]) {
  const magnitude = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0))
  if (magnitude === 0) return vector
  return vector.map((value) => value / magnitude)
}
