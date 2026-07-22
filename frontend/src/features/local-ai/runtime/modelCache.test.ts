import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  clearLocalAiModelCache,
  modelCacheScope,
  readOrFetchVerifiedModelAsset,
  removeCachedModel,
} from './modelCache'
import type { Sha256Digest } from './types'

class MemoryCache {
  entries = new Map<string, Response>()

  async match(request: Request) {
    return this.entries.get(request.url)?.clone()
  }

  async put(request: Request, response: Response) {
    this.entries.set(request.url, response.clone())
  }

  async delete(request: Request) {
    return this.entries.delete(request.url)
  }

  async keys() {
    return [...this.entries.keys()].map((url) => new Request(url))
  }
}

class MemoryCacheStorage {
  caches = new Map<string, MemoryCache>()

  async open(name: string) {
    const cache = this.caches.get(name) ?? new MemoryCache()
    this.caches.set(name, cache)
    return cache
  }

  async delete(name: string) {
    return this.caches.delete(name)
  }
}

const digest = async (bytes: Uint8Array): Promise<Sha256Digest> => {
  const value = await crypto.subtle.digest('SHA-256', Uint8Array.from(bytes).buffer)
  const hex = Array.from(new Uint8Array(value), (byte) =>
    byte.toString(16).padStart(2, '0'),
  ).join('')
  return `sha256-${hex}`
}

describe('versioned model chunk cache', () => {
  let storage: MemoryCacheStorage

  beforeEach(() => {
    storage = new MemoryCacheStorage()
    vi.stubGlobal('caches', storage)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('serves a verified chunk offline after its first fetch', async () => {
    const bytes = new Uint8Array([1, 2, 3])
    const expectedDigest = await digest(bytes)
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockImplementation(async () => new Response(bytes))
    await readOrFetchVerifiedModelAsset('http://localhost/chunk', 3, expectedDigest, {
      scope: 'model@1',
    })
    fetchMock.mockRejectedValue(new TypeError('offline'))

    const cached = await readOrFetchVerifiedModelAsset(
      'http://localhost/chunk',
      3,
      expectedDigest,
      { scope: 'model@1' },
    )
    expect([...new Uint8Array(cached)]).toEqual([1, 2, 3])
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('deletes a corrupt cache entry and replaces it only after verification', async () => {
    const bytes = new Uint8Array([4, 5, 6])
    const expectedDigest = await digest(bytes)
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockImplementation(async () => new Response(bytes))
    await readOrFetchVerifiedModelAsset('http://localhost/chunk', 3, expectedDigest, {
      scope: 'model@1',
    })
    const cache = [...storage.caches.values()][0]
    const key = [...cache.entries.keys()][0]
    cache.entries.set(key, new Response(new Uint8Array([9, 9, 9])))

    const repaired = await readOrFetchVerifiedModelAsset(
      'http://localhost/chunk',
      3,
      expectedDigest,
      { scope: 'model@1' },
    )
    expect([...new Uint8Array(repaired)]).toEqual([4, 5, 6])
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('does not retain a failed or partial download', async () => {
    const expectedDigest = await digest(new Uint8Array([1, 2, 3]))
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(new Uint8Array([1, 2])))
    await expect(
      readOrFetchVerifiedModelAsset('http://localhost/chunk', 3, expectedDigest, {
        scope: 'model@1',
      }),
    ).rejects.toThrow('integrity')
    const cache = [...storage.caches.values()][0]
    expect(cache.entries.size).toBe(0)
  })

  it('retries a transient request failure and caches the verified response', async () => {
    const bytes = new Uint8Array([3, 2, 1])
    const expectedDigest = await digest(bytes)
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockRejectedValueOnce(new TypeError('connection reset'))
      .mockResolvedValueOnce(new Response(bytes))

    const result = await readOrFetchVerifiedModelAsset(
      'http://localhost/retry-chunk',
      3,
      expectedDigest,
      { scope: 'model@1' },
    )

    expect([...new Uint8Array(result)]).toEqual([3, 2, 1])
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect([...storage.caches.values()][0].entries.size).toBe(1)
  })

  it('does not retry a permanent missing-asset response', async () => {
    const expectedDigest = await digest(new Uint8Array([1]))
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(null, { status: 404 }))

    await expect(
      readOrFetchVerifiedModelAsset('http://localhost/missing', 1, expectedDigest, {
        scope: 'model@1',
      }),
    ).rejects.toThrow('HTTP 404')
    expect(fetchMock).toHaveBeenCalledOnce()
  })

  it('continues with verified bytes when the browser cache quota is exhausted', async () => {
    const bytes = new Uint8Array([6, 6, 6])
    const expectedDigest = await digest(bytes)
    const cache = await storage.open('applyfill-local-ai-model-chunks-v1')
    vi.spyOn(cache, 'put').mockRejectedValue(new DOMException('Quota exceeded', 'QuotaExceededError'))
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(bytes))
    const warning = vi.spyOn(console, 'warn').mockImplementation(() => undefined)

    const result = await readOrFetchVerifiedModelAsset(
      'http://localhost/quota-chunk',
      3,
      expectedDigest,
      { scope: 'model@1' },
    )

    expect([...new Uint8Array(result)]).toEqual([6, 6, 6])
    expect(warning).toHaveBeenCalledOnce()
  })

  it('removes one model version without touching another', async () => {
    const bytes = new Uint8Array([7])
    const expectedDigest = await digest(bytes)
    vi.spyOn(globalThis, 'fetch').mockImplementation(async () => new Response(bytes))
    const firstModel = { id: 'first', version: '1' }
    const secondModel = { id: 'second', version: '2' }
    await readOrFetchVerifiedModelAsset('http://localhost/chunk-a', 1, expectedDigest, {
      scope: modelCacheScope(firstModel),
    })
    await readOrFetchVerifiedModelAsset('http://localhost/chunk-b', 1, expectedDigest, {
      scope: modelCacheScope(secondModel),
    })
    expect(await removeCachedModel(firstModel)).toBe(1)
    const cache = [...storage.caches.values()][0]
    expect(cache.entries.size).toBe(1)
  })

  it('clears every cached model explicitly', async () => {
    const bytes = new Uint8Array([8])
    const expectedDigest = await digest(bytes)
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(bytes))
    await readOrFetchVerifiedModelAsset('http://localhost/chunk', 1, expectedDigest, {
      scope: 'model@1',
    })
    expect(await clearLocalAiModelCache()).toBe(true)
    expect(storage.caches.size).toBe(0)
  })
})
