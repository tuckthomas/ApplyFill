import type { ModelArtifact, RuntimeProgress, Sha256Digest } from './types'
import { readOrFetchVerifiedModelAsset } from './modelCache'

const CLOUDFLARE_STATIC_ASSET_LIMIT = 25 * 1024 * 1024

export class ModelIntegrityError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ModelIntegrityError'
  }
}

export class ModelOriginError extends Error {
  constructor(url: string) {
    super(`Local AI model assets must be served from the application origin: ${url}`)
    this.name = 'ModelOriginError'
  }
}

function sameOriginUrl(url: string): string {
  const base = globalThis.location?.href ?? 'http://localhost/'
  const resolved = new URL(url, base)
  if (resolved.origin !== new URL(base).origin) throw new ModelOriginError(url)
  return resolved.href
}

function normalizeDigest(digest: Sha256Digest): string {
  const value = digest.slice('sha256-'.length).toLowerCase()
  if (!/^[a-f0-9]{64}$/.test(value)) {
    throw new ModelIntegrityError('Model manifest contains an invalid SHA-256 digest.')
  }
  return value
}

async function sha256(bytes: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')
}

function validateArtifact(artifact: ModelArtifact): void {
  const hasSingleSource = typeof artifact.url === 'string'
  const hasChunks = Boolean(artifact.chunks?.length)
  if (hasSingleSource === hasChunks) {
    throw new ModelIntegrityError('A model artifact must define exactly one URL or a chunk list.')
  }
  if (!Number.isSafeInteger(artifact.byteSize) || artifact.byteSize <= 0) {
    throw new ModelIntegrityError('Model artifact byte size must be a positive safe integer.')
  }
  normalizeDigest(artifact.digest)

  if (artifact.chunks) {
    const total = artifact.chunks.reduce((sum, chunk) => {
      if (chunk.byteSize > CLOUDFLARE_STATIC_ASSET_LIMIT) {
        throw new ModelIntegrityError(
          `Model chunk ${chunk.url} exceeds Cloudflare's 25 MiB static asset limit.`,
        )
      }
      normalizeDigest(chunk.digest)
      return sum + chunk.byteSize
    }, 0)
    if (total !== artifact.byteSize) {
      throw new ModelIntegrityError('Model chunk sizes do not equal the declared artifact size.')
    }
  }
}

async function fetchBytes(
  url: string,
  expectedSize: number,
  expectedDigest: Sha256Digest,
  signal: AbortSignal | undefined,
  cacheScope: string,
): Promise<ArrayBuffer> {
  return readOrFetchVerifiedModelAsset(sameOriginUrl(url), expectedSize, expectedDigest, {
    signal,
    scope: cacheScope,
  })
}

/**
 * Downloads a manifest-approved artifact after the caller has obtained explicit
 * user consent. Interrupted downloads are never committed; retry starts cleanly.
 * Chunked artifacts keep every deployable file below Cloudflare's static limit.
 */
export async function fetchVerifiedModelArtifact(
  artifact: ModelArtifact,
  options: {
    signal?: AbortSignal
    onProgress?: (progress: RuntimeProgress) => void
    cacheScope?: string
  } = {},
): Promise<Blob> {
  validateArtifact(artifact)
  const parts: ArrayBuffer[] = []
  let completed = 0

  const sources = artifact.chunks ?? [
    { url: artifact.url as string, byteSize: artifact.byteSize, digest: artifact.digest },
  ]

  for (const source of sources) {
    options.signal?.throwIfAborted()
    const bytes = await fetchBytes(
      source.url,
      source.byteSize,
      source.digest,
      options.signal,
      options.cacheScope ?? 'unscoped',
    )
    parts.push(bytes)
    completed += bytes.byteLength
    options.onProgress?.({
      phase: 'downloading',
      completed,
      total: artifact.byteSize,
      message: `Downloaded ${completed.toLocaleString()} of ${artifact.byteSize.toLocaleString()} bytes`,
    })
  }

  options.onProgress?.({
    phase: 'verifying',
    completed: artifact.byteSize,
    total: artifact.byteSize,
    message: 'Verifying complete model artifact',
  })
  const blob = new Blob(parts, { type: 'application/octet-stream' })
  if ((await sha256(await blob.arrayBuffer())) !== normalizeDigest(artifact.digest)) {
    throw new ModelIntegrityError('Complete model artifact integrity check failed.')
  }
  return blob
}

/**
 * Uses a verified stream for prepared chunk manifests so multi-gigabyte models
 * are never duplicated in browser memory before LiteRT-LM starts streaming
 * them into its GPU Artisan loader. The preparation script validates the whole
 * upstream digest; the browser validates size/order and every chunk digest.
 */
export function createVerifiedModelSource(
  artifact: ModelArtifact,
  options: {
    signal?: AbortSignal
    onProgress?: (progress: RuntimeProgress) => void
    cacheScope?: string
  } = {},
): Blob | ReadableStream<Uint8Array> | Promise<Blob> {
  validateArtifact(artifact)
  if (!artifact.chunks) return fetchVerifiedModelArtifact(artifact, options)

  let index = 0
  let completed = 0
  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        options.signal?.throwIfAborted()
        const chunk = artifact.chunks?.[index]
        if (!chunk) {
          if (completed !== artifact.byteSize) {
            throw new ModelIntegrityError('Streamed model size does not match its manifest.')
          }
          controller.close()
          return
        }
        const bytes = await fetchBytes(
          chunk.url,
          chunk.byteSize,
          chunk.digest,
          options.signal,
          options.cacheScope ?? 'unscoped',
        )
        completed += bytes.byteLength
        index += 1
        options.onProgress?.({
          phase: 'downloading',
          completed,
          total: artifact.byteSize,
          message: `Verified ${completed.toLocaleString()} of ${artifact.byteSize.toLocaleString()} bytes`,
        })
        controller.enqueue(new Uint8Array(bytes))
      } catch (error) {
        controller.error(error)
      }
    },
    cancel() {
      index = artifact.chunks?.length ?? 0
    },
  })
}
