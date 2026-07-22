import type { ModelManifestEntry, Sha256Digest } from './types'

const MODEL_CACHE_NAME = 'applyfill-local-ai-model-chunks-v1'
const CACHE_PATH_PREFIX = '/.applyfill-local-ai-cache/'
const MODEL_FETCH_ATTEMPTS = 3

const digestHex = (digest: Sha256Digest) => digest.slice('sha256-'.length).toLowerCase()

async function sha256(bytes: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')
}

const cacheStorage = (): CacheStorage | undefined =>
  typeof globalThis.caches === 'undefined' ? undefined : globalThis.caches

export function modelCacheScope(model: Pick<ModelManifestEntry, 'id' | 'version'>): string {
  return `${model.id}@${model.version}`
}

function cacheKey(scope: string, digest: Sha256Digest): Request {
  const origin = globalThis.location?.origin ?? 'http://localhost'
  const path = `${CACHE_PATH_PREFIX}${encodeURIComponent(scope)}/${digestHex(digest)}`
  return new Request(new URL(path, origin), { credentials: 'same-origin' })
}

async function verifiedBytes(
  response: Response,
  expectedSize: number,
  expectedDigest: Sha256Digest,
): Promise<ArrayBuffer | undefined> {
  const bytes = await response.arrayBuffer()
  if (bytes.byteLength !== expectedSize) return undefined
  return (await sha256(bytes)) === digestHex(expectedDigest) ? bytes : undefined
}

const isRetriableStatus = (status: number): boolean =>
  status === 408 || status === 429 || status >= 500

function waitForRetry(delayMs: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    signal?.throwIfAborted()
    const abort = () => {
      globalThis.clearTimeout(timeout)
      reject(signal?.reason ?? new DOMException('The operation was aborted.', 'AbortError'))
    }
    const timeout = globalThis.setTimeout(() => {
      signal?.removeEventListener('abort', abort)
      resolve()
    }, delayMs)
    signal?.addEventListener('abort', abort, { once: true })
  })
}

async function fetchWithRetry(sourceUrl: string, signal?: AbortSignal): Promise<Response> {
  let lastError: unknown
  for (let attempt = 1; attempt <= MODEL_FETCH_ATTEMPTS; attempt += 1) {
    signal?.throwIfAborted()
    let response: Response
    try {
      response = await fetch(sourceUrl, {
        signal,
        credentials: 'same-origin',
        cache: 'no-store',
      })
    } catch (error) {
      if (signal?.aborted) throw error
      lastError = error
      if (attempt === MODEL_FETCH_ATTEMPTS) throw error
      await waitForRetry(250 * 2 ** (attempt - 1), signal)
      continue
    }
    if (response.ok) return response
    lastError = new Error(`Model download failed with HTTP ${response.status}.`)
    if (!isRetriableStatus(response.status) || attempt === MODEL_FETCH_ATTEMPTS) {
      throw lastError
    }
    await waitForRetry(250 * 2 ** (attempt - 1), signal)
  }
  throw lastError
}

/**
 * Reads a verified model chunk from the versioned Cache Storage cache, or
 * fetches and verifies it before committing it. Partial and corrupt responses
 * are never retained. Cache Storage is intentionally separate from profile
 * IndexedDB data and remains usable while the network is offline.
 */
export async function readOrFetchVerifiedModelAsset(
  sourceUrl: string,
  expectedSize: number,
  expectedDigest: Sha256Digest,
  options: { signal?: AbortSignal; scope: string },
): Promise<ArrayBuffer> {
  const storage = cacheStorage()
  const key = cacheKey(options.scope, expectedDigest)
  const cache = storage ? await storage.open(MODEL_CACHE_NAME) : undefined
  const cached = await cache?.match(key)
  if (cached) {
    const bytes = await verifiedBytes(cached, expectedSize, expectedDigest)
    if (bytes) return bytes
    await cache?.delete(key)
  }

  const response = await fetchWithRetry(sourceUrl, options.signal)
  const bytes = await verifiedBytes(response, expectedSize, expectedDigest)
  if (!bytes) throw new Error(`Model asset failed its size or SHA-256 integrity check: ${sourceUrl}`)

  try {
    await cache?.put(
      key,
      new Response(bytes.slice(0), {
        headers: {
          'content-type': 'application/octet-stream',
          'x-applyfill-model-scope': options.scope,
          'x-applyfill-sha256': digestHex(expectedDigest),
        },
      }),
    )
  } catch (error) {
    // Browser storage quotas vary by device and profile. A valid same-origin
    // download remains usable for this session even when it cannot be cached.
    console.warn('A verified local AI model chunk could not be cached for offline reuse.', error)
  }
  return bytes
}

export async function removeCachedModel(
  model: Pick<ModelManifestEntry, 'id' | 'version'>,
): Promise<number> {
  const storage = cacheStorage()
  if (!storage) return 0
  const cache = await storage.open(MODEL_CACHE_NAME)
  const scopePrefix = `${CACHE_PATH_PREFIX}${encodeURIComponent(modelCacheScope(model))}/`
  const keys = await cache.keys()
  const matching = keys.filter((request) => new URL(request.url).pathname.startsWith(scopePrefix))
  const results = await Promise.all(matching.map((request) => cache.delete(request)))
  return results.filter(Boolean).length
}

export async function clearLocalAiModelCache(): Promise<boolean> {
  return (await cacheStorage()?.delete(MODEL_CACHE_NAME)) ?? false
}
