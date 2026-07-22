import { describe, expect, it, vi } from 'vitest'
import { compatibleAccelerators, selectAccelerator } from './acceleratorSelection'
import {
  fetchVerifiedModelArtifact,
  createVerifiedModelSource,
  ModelOriginError,
} from './artifactLoader'
import { FakeLocalAiRuntime, FailureLocalAiRuntime } from './fakeRuntime'
import { LiteRtLmRuntime } from './liteRtLmRuntime'
import { assertRuntimeTransition, InvalidRuntimeTransitionError } from './lifecycle'
import type { ModelManifestEntry, RuntimeCapabilities, Sha256Digest } from './types'

const capabilities: RuntimeCapabilities = {
  secureContext: true,
  jspi: true,
  crossOriginIsolated: false,
  sharedArrayBuffer: false,
  accelerators: {
    'webnn-npu': { available: true, experimental: true },
    'webnn-gpu': { available: true, experimental: true },
    'webnn-cpu': { available: true, experimental: true },
    webgpu: { available: true, experimental: false },
    wasm: { available: true, experimental: false },
  },
}

const model: ModelManifestEntry = {
  id: 'test-model',
  version: '1',
  displayName: 'Test model',
  runtime: 'litert-lm-js',
  runtimeVersion: '0.14.0',
  format: '.litertlm',
  contextLimit: 1_024,
  artifact: {
    url: '/model.litertlm',
    byteSize: 1,
    digest: `sha256-${'0'.repeat(64)}`,
  },
  supportedAccelerators: ['webgpu'],
  license: {
    name: 'Test-only',
    url: 'https://example.invalid/license',
    attribution: 'Synthetic test model',
    redistributionAllowed: false,
  },
  approvedTasks: ['test'],
}

describe('runtime lifecycle', () => {
  it('accepts legal transitions and rejects illegal transitions', () => {
    expect(() => assertRuntimeTransition('idle', 'downloading')).not.toThrow()
    expect(() => assertRuntimeTransition('ready', 'running')).not.toThrow()
    expect(() => assertRuntimeTransition('disposed', 'idle')).toThrow(
      InvalidRuntimeTransitionError,
    )
    expect(() => assertRuntimeTransition('running', 'downloading')).toThrow(
      InvalidRuntimeTransitionError,
    )
  })
})

describe('accelerator selection', () => {
  it('uses the broadly supported WebGPU path first in automatic mode', async () => {
    const attempts: string[] = []
    const result = await selectAccelerator(capabilities, 'automatic', async (accelerator) => {
      attempts.push(accelerator)
      return accelerator === 'webgpu'
        ? { ok: true, actualAccelerator: 'webgpu' }
        : { ok: false, reason: 'model compile rejected' }
    })
    expect(attempts).toEqual(['webgpu'])
    expect(result.actualAccelerator).toBe('webgpu')
    expect(result.fallbackReason).toBeUndefined()
  })

  it('filters automatic setup to accelerators supported by the selected model', () => {
    expect(compatibleAccelerators(capabilities, 'automatic', model.supportedAccelerators)).toEqual(['webgpu'])
    expect(compatibleAccelerators(capabilities, 'experimental-npu', model.supportedAccelerators)).toEqual([])
  })

  it('does not silently fall back when an accelerator is pinned', async () => {
    await expect(
      selectAccelerator(capabilities, 'experimental-npu', async () => ({
        ok: false,
        reason: 'unsupported operation',
      })),
    ).rejects.toThrow('unsupported operation')
  })

  it('rejects an unsupported model/accelerator pairing before downloading', async () => {
    const runtime = new LiteRtLmRuntime()
    vi.spyOn(runtime, 'detectCapabilities').mockResolvedValue(capabilities)
    const fetchMock = vi.spyOn(globalThis, 'fetch')
    await expect(runtime.initialize({ model, acceleratorPreference: 'experimental-npu' }))
      .rejects.toThrow('does not have a supported way')
    expect(fetchMock).not.toHaveBeenCalled()
  })
})

describe('fake runtime', () => {
  it('streams deterministic output and exports content-free diagnostics', async () => {
    const runtime = new FakeLocalAiRuntime({
      capabilities,
      actualAccelerator: 'webgpu',
      response: { text: 'private prompt result', toolCalls: [], finishReason: 'completed' },
    })
    await runtime.initialize({ model, acceleratorPreference: 'automatic' })
    const tokens: string[] = []
    await runtime.generate({ input: 'SSN 000-00-0000', onToken: (token) => tokens.push(token) })

    expect(tokens.join('')).toBe('private prompt result')
    const diagnostics = runtime.exportDiagnostics()
    expect(diagnostics).not.toContain('SSN')
    expect(diagnostics).not.toContain('private prompt result')
    expect(diagnostics).toContain('webgpu')
  })

  it('rejects concurrent generation and recovers for another run', async () => {
    const runtime = new FakeLocalAiRuntime({ capabilities, latencyMs: 20 })
    await runtime.initialize({ model, acceleratorPreference: 'automatic' })
    const first = runtime.generate({ input: 'first' })
    await expect(runtime.generate({ input: 'second' })).rejects.toThrow()
    await first
    await expect(runtime.generate({ input: 'third' })).resolves.toMatchObject({
      finishReason: 'completed',
    })
  })

  it('cancels without poisoning runtime state', async () => {
    const runtime = new FakeLocalAiRuntime({ capabilities, latencyMs: 30 })
    await runtime.initialize({ model, acceleratorPreference: 'automatic' })
    const controller = new AbortController()
    const pending = runtime.generate({ input: 'cancel me', signal: controller.signal })
    controller.abort()
    await expect(pending).resolves.toMatchObject({ finishReason: 'cancelled' })
    expect(runtime.snapshot.state).toBe('ready')
  })

  it('surfaces deterministic initialization failure and supports reset/dispose', async () => {
    const runtime = new FailureLocalAiRuntime('compile failed')
    await expect(
      runtime.initialize({ model, acceleratorPreference: 'automatic' }),
    ).rejects.toThrow('compile failed')
    expect(runtime.snapshot.state).toBe('failed')
    await runtime.reset()
    expect(runtime.snapshot.state).toBe('idle')
    await runtime.dispose()
    expect(runtime.snapshot.state).toBe('disposed')
  })
})

describe('model artifact integrity', () => {
  it('verifies every chunk and the reassembled artifact', async () => {
    const chunks = [new Uint8Array([1, 2]), new Uint8Array([3, 4])]
    const digest = async (bytes: Uint8Array): Promise<Sha256Digest> => {
      const value = await crypto.subtle.digest('SHA-256', Uint8Array.from(bytes).buffer)
      const hex = Array.from(new Uint8Array(value), (byte) =>
        byte.toString(16).padStart(2, '0'),
      ).join('')
      return `sha256-${hex}`
    }
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response(chunks[0]))
      .mockResolvedValueOnce(new Response(chunks[1]))
    const artifact = {
      byteSize: 4,
      digest: await digest(new Uint8Array([1, 2, 3, 4])),
      chunks: [
        { url: '/model.000', byteSize: 2, digest: await digest(chunks[0]) },
        { url: '/model.001', byteSize: 2, digest: await digest(chunks[1]) },
      ],
    }

    const blob = await fetchVerifiedModelArtifact(artifact)
    expect([...new Uint8Array(await blob.arrayBuffer())]).toEqual([1, 2, 3, 4])
    expect(fetchMock).toHaveBeenCalledTimes(2)
    fetchMock.mockRestore()
  })

  it('streams verified prepared chunks without assembling the whole artifact first', async () => {
    const bytes = new Uint8Array([7, 8])
    const value = await crypto.subtle.digest('SHA-256', Uint8Array.from(bytes).buffer)
    const hex = Array.from(new Uint8Array(value), (byte) =>
      byte.toString(16).padStart(2, '0'),
    ).join('')
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(bytes))
    const source = createVerifiedModelSource({
      byteSize: 2,
      digest: `sha256-${hex}`,
      chunks: [{ url: '/chunk', byteSize: 2, digest: `sha256-${hex}` }],
    })
    expect(source).toBeInstanceOf(ReadableStream)
    const response = new Response(source as ReadableStream<Uint8Array>)
    expect([...new Uint8Array(await response.arrayBuffer())]).toEqual([7, 8])
    fetchMock.mockRestore()
  })

  it('rejects integrity mismatches', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response(new Uint8Array([1])))
    await expect(
      fetchVerifiedModelArtifact({
        url: '/model',
        byteSize: 1,
        digest: `sha256-${'0'.repeat(64)}`,
      }),
    ).rejects.toThrow('integrity')
    fetchMock.mockRestore()
  })

  it('rejects cross-origin runtime model downloads', async () => {
    await expect(
      fetchVerifiedModelArtifact({
        url: 'https://models.example.com/model.litertlm',
        byteSize: 1,
        digest: `sha256-${'0'.repeat(64)}`,
      }),
    ).rejects.toThrow(ModelOriginError)
  })
})
