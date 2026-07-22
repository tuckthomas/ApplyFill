import { BaseLocalAiRuntime } from './baseRuntime'
import { detectRuntimeCapabilities } from './capabilities'
import type {
  AcceleratorId,
  LocalAiRuntime,
  RuntimeCapabilities,
  RuntimeGenerationResult,
  RuntimeState,
} from './types'

export interface FakeRuntimeOptions {
  capabilities?: RuntimeCapabilities
  actualAccelerator?: AcceleratorId
  fallbackReason?: string
  response?: RuntimeGenerationResult
  initializeError?: Error
  generationError?: Error
  latencyMs?: number
}

const wait = (milliseconds: number, signal?: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    const timer = setTimeout(resolve, milliseconds)
    signal?.addEventListener(
      'abort',
      () => {
        clearTimeout(timer)
        reject(signal.reason ?? new DOMException('The operation was aborted.', 'AbortError'))
      },
      { once: true },
    )
  })

export class FakeLocalAiRuntime extends BaseLocalAiRuntime {
  readonly options: FakeRuntimeOptions
  #running = false

  constructor(options: FakeRuntimeOptions = {}) {
    super()
    this.options = options
  }

  async detectCapabilities(): Promise<RuntimeCapabilities> {
    return this.options.capabilities ?? detectRuntimeCapabilities()
  }

  async initialize(
    options: Parameters<LocalAiRuntime['initialize']>[0],
  ): ReturnType<LocalAiRuntime['initialize']> {
    this.ensureNotDisposed()
    const startedAt = performance.now()
    const capabilities = await this.detectCapabilities()
    this.updateDiagnostics({
      browserSupported: Object.values(capabilities.accelerators).some((value) => value.available),
      capabilities,
      desiredAccelerator: options.acceleratorPreference,
      modelId: options.model.id,
      modelVersion: options.model.version,
    })
    this.transition('downloading')
    options.onProgress?.({ phase: 'downloading', completed: 1, total: 1, message: 'Fake download' })
    await wait(this.options.latencyMs ?? 0, options.signal)
    this.transition('compiling')
    if (this.options.initializeError) {
      this.transition('failed')
      throw this.options.initializeError
    }
    this.updateDiagnostics({
      actualAccelerator: this.options.actualAccelerator ?? 'wasm',
      fallbackReason: this.options.fallbackReason,
      initializationDurationMs: performance.now() - startedAt,
    })
    this.transition('ready')
    return this.snapshot.diagnostics
  }

  async generate(
    options: Parameters<LocalAiRuntime['generate']>[0],
  ): ReturnType<LocalAiRuntime['generate']> {
    this.ensureNotDisposed()
    if (this.snapshot.state !== 'ready') throw new Error('The local AI runtime is not ready.')
    if (this.#running) throw new Error('A local AI generation is already running.')
    this.#running = true
    this.transition('running')
    const startedAt = performance.now()
    try {
      await wait(this.options.latencyMs ?? 0, options.signal)
      if (this.options.generationError) throw this.options.generationError
      const result = this.options.response ?? {
        text: '{"status":"fake"}',
        toolCalls: [],
        finishReason: 'completed',
      }
      for (const token of result.text.split(/(?<=\s)/)) options.onToken?.(token)
      const durationSeconds = Math.max((performance.now() - startedAt) / 1_000, 0.001)
      this.updateDiagnostics({
        firstTokenLatencyMs: this.options.latencyMs ?? 0,
        generationTokensPerSecond: result.text.split(/\s+/).length / durationSeconds,
      })
      return result
    } catch (error) {
      if (options.signal?.aborted) {
        return { text: '', toolCalls: [], finishReason: 'cancelled' }
      }
      this.recordRecoverableError('generation-failed', error)
      throw error
    } finally {
      this.#running = false
      const finalState = this.snapshot.state as RuntimeState
      if (finalState === 'running') this.transition('ready')
    }
  }

  async reset(): Promise<void> {
    this.ensureNotDisposed()
    if (this.#running) throw new Error('Cannot reset while generation is running.')
    if (this.snapshot.state !== 'idle') this.transition('idle')
    this.replaceDiagnostics({ browserSupported: false, recoverableErrors: [] })
  }

  async dispose(): Promise<void> {
    if (this.snapshot.state !== 'disposed') this.transition('disposed')
  }
}

export class FailureLocalAiRuntime extends FakeLocalAiRuntime {
  constructor(message = 'Local AI initialization failed.') {
    super({ initializeError: new Error(message) })
  }
}
