/**
 * Bounded fetch for LLM providers — avoids hung streams when the network stalls.
 */
export async function fetchWithDeadline(
  url: string,
  init: RequestInit,
  deadlineMs: number,
  label = 'Request',
): Promise<Response> {
  const ctrl = new AbortController()
  const timer = setTimeout(() => {
    ctrl.abort(new Error(`${label} timed out after ${deadlineMs}ms`))
  }, deadlineMs)

  const parent = init.signal
  const onParentAbort = () => {
    clearTimeout(timer)
    ctrl.abort(parent?.reason ?? new Error('Aborted'))
  }

  if (parent) {
    if (parent.aborted) {
      clearTimeout(timer)
      throw parent.reason instanceof Error ? parent.reason : new Error(String(parent.reason))
    }
    parent.addEventListener('abort', onParentAbort, { once: true })
  }

  try {
    return await fetch(url, { ...init, signal: ctrl.signal })
  } finally {
    clearTimeout(timer)
    if (parent) parent.removeEventListener('abort', onParentAbort)
  }
}

const DEFAULT_STREAM_CHUNK_MS = Math.min(
  Math.max(45_000, Number(process.env.JARVIS_STREAM_CHUNK_READ_MS ?? 120_000)),
  600_000,
)

/**
 * One `ReadableStreamDefaultReader.read()` bounded in time — fixes hung NDJSON/SSE bodies.
 */
export async function readStreamChunkWithTimeout(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  chunkReadMs: number = DEFAULT_STREAM_CHUNK_MS,
): Promise<{ done: boolean; value?: Uint8Array }> {
  return new Promise((resolve, reject) => {
    let settled = false
    const t = setTimeout(() => {
      if (settled) return
      settled = true
      void reader.cancel().catch(() => {})
      reject(new Error(`Stream read stalled after ${chunkReadMs}ms (no bytes).`))
    }, chunkReadMs)
    reader
      .read()
      .then((r) => {
        if (settled) return
        settled = true
        clearTimeout(t)
        resolve(r)
      })
      .catch((err) => {
        if (settled) return
        settled = true
        clearTimeout(t)
        reject(err)
      })
  })
}
