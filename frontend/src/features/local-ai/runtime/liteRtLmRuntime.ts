import type { Conversation, Engine, Message, Tool } from '@litert-lm/core'
import { selectAccelerator } from './acceleratorSelection'
import { createVerifiedModelSource } from './artifactLoader'
import { BaseLocalAiRuntime } from './baseRuntime'
import { detectRuntimeCapabilities } from './capabilities'
import { modelCacheScope, readOrFetchVerifiedModelAsset } from './modelCache'
import type {
  AcceleratorId,
  LocalAiRuntime,
  RuntimeState,
  RuntimeToolCall,
} from './types'

const LITERT_LM_VERSION = '0.14.0'
const LITERT_LM_WASM_BYTE_SIZE = 19_848_204
const LITERT_LM_WASM_DIGEST =
  'sha256-54c3c54b6fedc89267556ba73abeab2f6ec3cfdece8c6e9e0e2d71e9786f437b' as const

const localWasmModuleUrl = () =>
  new URL(
    `${import.meta.env.BASE_URL}vendor/litert-lm/wasm/litertlm_wasm_internal.js`,
    globalThis.location?.origin ?? 'http://localhost',
  ).href

const localWasmBinaryUrl = () =>
  new URL(
    `${import.meta.env.BASE_URL}vendor/litert-lm/wasm/litertlm_wasm_internal.wasm`,
    globalThis.location?.origin ?? 'http://localhost',
  ).href

function messageText(message: Message): string {
  if (typeof message.content === 'string') return message.content
  if (!Array.isArray(message.content)) return ''
  return message.content
    .filter((part) => part.type === 'text')
    .map((part) => (part.type === 'text' ? part.text : ''))
    .join('')
}

function messageToolCalls(message: Message): RuntimeToolCall[] {
  return (message.tool_calls ?? []).map((call) => ({
    id: call.id,
    name: call.function.name,
    arguments: call.function.arguments,
  }))
}

export class LiteRtLmRuntime extends BaseLocalAiRuntime {
  #engine: Engine | undefined
  #running = false

  async detectCapabilities() {
    return detectRuntimeCapabilities()
  }

  async initialize(
    options: Parameters<LocalAiRuntime['initialize']>[0],
  ): ReturnType<LocalAiRuntime['initialize']> {
    this.ensureNotDisposed()
    if (this.#running) throw new Error('Cannot initialize while generation is running.')
    if (this.#engine) await this.releaseEngine()
    if (this.snapshot.state !== 'idle') this.transition('idle')

    const startedAt = performance.now()
    const configuredContextLimit = Math.min(
      options.model.operationalContextLimit ?? 4_096,
      options.model.contextLimit,
    )
    const capabilities = await this.detectCapabilities()
    this.replaceDiagnostics({
      browserSupported: capabilities.jspi && capabilities.accelerators.webgpu.available,
      capabilities,
      modelId: options.model.id,
      modelVersion: options.model.version,
      desiredAccelerator: options.acceleratorPreference,
      configuredContextLimit,
      recoverableErrors: [],
    })

    if (!capabilities.jspi && options.acceleratorPreference !== 'wasm') {
      this.transition('unsupported')
      throw new Error(
        'This local LiteRT-LM build requires WebAssembly JSPI. No CDN fallback is permitted.',
      )
    }

    try {
      this.transition('downloading')
      const model = await createVerifiedModelSource(options.model.artifact, {
        signal: options.signal,
        onProgress: options.onProgress,
        cacheScope: modelCacheScope(options.model),
      })
      options.signal?.throwIfAborted()
      this.transition('compiling')
      options.onProgress?.({
        phase: 'compiling',
        completed: 0,
        message: 'Compiling the local language model',
      })

      const selected = await selectAccelerator(
        capabilities,
        options.acceleratorPreference,
        async (accelerator) => this.compile(model, accelerator, configuredContextLimit),
      )
      this.updateDiagnostics({
        actualAccelerator: selected.actualAccelerator,
        fallbackReason: selected.fallbackReason,
        initializationDurationMs: performance.now() - startedAt,
      })
      this.transition('ready')
      options.onProgress?.({
        phase: 'compiling',
        completed: 1,
        total: 1,
        message: 'Local language model is ready',
      })
      return this.snapshot.diagnostics
    } catch (error) {
      await this.releaseEngine()
      if (options.signal?.aborted) {
        if (this.snapshot.state !== 'idle') this.transition('idle')
      } else if (this.snapshot.state !== 'unsupported') {
        this.recordRecoverableError('initialization-failed', error)
        this.transition('failed')
      }
      throw error
    }
  }

  async generate(
    options: Parameters<LocalAiRuntime['generate']>[0],
  ): ReturnType<LocalAiRuntime['generate']> {
    this.ensureNotDisposed()
    if (this.#running) throw new Error('A local AI generation is already running.')
    if (this.snapshot.state !== 'ready' || !this.#engine) {
      throw new Error('The local AI runtime is not ready.')
    }

    this.#running = true
    this.transition('running')
    let conversation: Conversation | undefined
    let abortListener: (() => void) | undefined
    const startedAt = performance.now()
    let firstTokenAt: number | undefined
    let text = ''
    const toolCalls: RuntimeToolCall[] = []

    try {
      const tools: Tool[] = (options.tools ?? []).map((tool) => ({
        type: 'function',
        function: {
          name: tool.name,
          description: tool.description,
          parameters: tool.inputSchema,
        },
      })) as Tool[]
      conversation = await this.#engine.createConversation({
        enableConstrainedDecoding: tools.length > 0,
        preface: tools.length > 0 ? { tools } : undefined,
      })
      abortListener = () => conversation?.cancel()
      options.signal?.addEventListener('abort', abortListener, { once: true })
      options.signal?.throwIfAborted()

      const stream = conversation.sendMessageStreaming(options.input)
      for await (const chunk of stream) {
        if (options.signal?.aborted) break
        const token = messageText(chunk)
        if (token) {
          firstTokenAt ??= performance.now()
          text += token
          options.onToken?.(token)
        }
        toolCalls.push(...messageToolCalls(chunk))
      }

      if (options.signal?.aborted) {
        return { text, toolCalls, finishReason: 'cancelled' }
      }

      const benchmark = await conversation.getBenchmarkInfo()
      this.updateDiagnostics({
        firstTokenLatencyMs:
          benchmark.timeToFirstTokenInSecond > 0
            ? benchmark.timeToFirstTokenInSecond * 1_000
            : firstTokenAt
              ? firstTokenAt - startedAt
              : undefined,
        generationTokensPerSecond:
          benchmark.lastDecodeTokensPerSecond > 0
            ? benchmark.lastDecodeTokensPerSecond
            : undefined,
      })
      return {
        text,
        toolCalls,
        finishReason: toolCalls.length > 0 ? 'tool-call' : 'completed',
      }
    } catch (error) {
      if (options.signal?.aborted) return { text, toolCalls, finishReason: 'cancelled' }
      this.recordRecoverableError('generation-failed', error)
      if (/device|gpu|lost|reset/i.test(error instanceof Error ? error.message : String(error))) {
        this.transition('failed')
      }
      throw error
    } finally {
      if (abortListener) options.signal?.removeEventListener('abort', abortListener)
      await conversation?.delete()
      this.#running = false
      const finalState = this.snapshot.state as RuntimeState
      if (finalState === 'running') this.transition('ready')
    }
  }

  async reset(): Promise<void> {
    this.ensureNotDisposed()
    if (this.#running) throw new Error('Cannot reset while generation is running.')
    await this.releaseEngine()
    if (this.snapshot.state !== 'idle') this.transition('idle')
    this.replaceDiagnostics({ browserSupported: false, recoverableErrors: [] })
  }

  async dispose(): Promise<void> {
    if (this.snapshot.state === 'disposed') return
    if (this.#running) throw new Error('Cancel generation before disposing the runtime.')
    await this.releaseEngine()
    this.transition('disposed')
  }

  private async compile(
    model: Blob | ReadableStream<Uint8Array>,
    accelerator: AcceleratorId,
    contextLimit: number,
  ) {
    if (accelerator !== 'webgpu') {
      return {
        ok: false as const,
        reason:
          `LiteRT-LM.js ${LITERT_LM_VERSION} officially supports browser text generation ` +
          'through WebGPU only; generic LiteRT.js NPU/WASM support does not imply LLM support.',
      }
    }

    const { Backend, Engine, getOrLoadGlobalLiteRtLm, hasGlobalLiteRtLm } =
      await import('@litert-lm/core')
    if (!hasGlobalLiteRtLm()) {
      const wasmBytes = await readOrFetchVerifiedModelAsset(
        localWasmBinaryUrl(),
        LITERT_LM_WASM_BYTE_SIZE,
        LITERT_LM_WASM_DIGEST,
        { scope: `litert-lm-runtime@${LITERT_LM_VERSION}` },
      )
      const runtimeGlobal = globalThis as typeof globalThis & {
        Module?: {
          locateFile: (filename: string) => string
          mainScriptUrlOrBlob: string
          wasmBinary: Uint8Array<ArrayBuffer>
        }
      }
      runtimeGlobal.Module = {
        locateFile: (filename) =>
          new URL(filename, new URL('.', localWasmModuleUrl())).href,
        mainScriptUrlOrBlob: localWasmModuleUrl(),
        wasmBinary: new Uint8Array(wasmBytes),
      }
    }
    await getOrLoadGlobalLiteRtLm(localWasmModuleUrl())
    this.#engine = await Engine.create({
      model,
      backend: Backend.GPU_ARTISAN,
      benchmarkEnabled: true,
      mainExecutorSettings: { maxNumTokens: contextLimit },
    })
    return { ok: true as const, actualAccelerator: 'webgpu' as const }
  }

  private async releaseEngine(): Promise<void> {
    if (this.#engine) {
      await this.#engine.delete()
      this.#engine = undefined
    }
  }
}
