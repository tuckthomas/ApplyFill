export type RuntimeState =
  | 'unsupported'
  | 'idle'
  | 'downloading'
  | 'compiling'
  | 'ready'
  | 'running'
  | 'failed'
  | 'disposed'

export type AcceleratorId =
  | 'webnn-npu'
  | 'webnn-gpu'
  | 'webnn-cpu'
  | 'webgpu'
  | 'wasm'

export type AcceleratorPreference = 'automatic' | 'experimental-npu' | 'webgpu' | 'wasm'

export type CapabilityFailureCode =
  | 'insecure-context'
  | 'webnn-api-missing'
  | 'webnn-jspi-missing'
  | 'webgpu-api-missing'
  | 'webgpu-adapter-missing'
  | 'wasm-missing'
  | 'shared-array-buffer-unavailable'
  | 'provider-not-supported'

export interface AcceleratorCapability {
  available: boolean
  experimental: boolean
  failureCode?: CapabilityFailureCode
  detail?: string
}

export interface RuntimeCapabilities {
  secureContext: boolean
  jspi: boolean
  crossOriginIsolated: boolean
  sharedArrayBuffer: boolean
  accelerators: Record<AcceleratorId, AcceleratorCapability>
}

export type Sha256Digest = `sha256-${string}`

export interface ModelArtifactChunk {
  url: string
  byteSize: number
  digest: Sha256Digest
}

export interface ModelArtifact {
  byteSize: number
  digest: Sha256Digest
  url?: string
  chunks?: ModelArtifactChunk[]
}

export interface ModelLicense {
  name: string
  url: string
  attribution: string
  redistributionAllowed: boolean
}

export interface ModelManifestEntry {
  id: string
  version: string
  displayName: string
  runtime: 'litert-lm-js' | 'litert-js'
  runtimeVersion: string
  format: '.litertlm' | '.tflite'
  contextLimit: number
  operationalContextLimit?: number
  artifact: ModelArtifact
  supportedAccelerators: AcceleratorId[]
  license: ModelLicense
  approvedTasks: string[]
}

export interface RuntimeProgress {
  phase: 'downloading' | 'verifying' | 'compiling' | 'generating'
  completed: number
  total?: number
  message: string
}

export interface RuntimeErrorSummary {
  code: string
  message: string
  recoverable: boolean
  occurredAt: string
}

export interface RuntimeDiagnostics {
  browserSupported: boolean
  modelId?: string
  modelVersion?: string
  desiredAccelerator?: AcceleratorPreference
  actualAccelerator?: AcceleratorId
  fallbackReason?: string
  initializationDurationMs?: number
  firstTokenLatencyMs?: number
  generationTokensPerSecond?: number
  configuredContextLimit?: number
  capabilities?: RuntimeCapabilities
  recoverableErrors?: RuntimeErrorSummary[]
}

export interface RuntimeSnapshot {
  state: RuntimeState
  diagnostics: RuntimeDiagnostics
}

export interface RuntimeToolDefinition {
  name: string
  description: string
  inputSchema: Record<string, unknown>
}

export interface RuntimeToolCall {
  id?: string
  name: string
  arguments: Record<string, unknown>
}

export interface RuntimeInitializeOptions {
  model: ModelManifestEntry
  acceleratorPreference: AcceleratorPreference
  signal?: AbortSignal
  onProgress?: (progress: RuntimeProgress) => void
}

export interface RuntimeGenerateOptions {
  input: string
  maxOutputTokens?: number
  tools?: RuntimeToolDefinition[]
  signal?: AbortSignal
  onToken?: (token: string) => void
}

export interface RuntimeGenerationResult {
  text: string
  toolCalls: RuntimeToolCall[]
  finishReason: 'completed' | 'tool-call' | 'cancelled'
}

export type RuntimeListener = (snapshot: RuntimeSnapshot) => void

export interface LocalAiRuntime {
  readonly snapshot: RuntimeSnapshot
  subscribe(listener: RuntimeListener): () => void
  detectCapabilities(): Promise<RuntimeCapabilities>
  initialize(options: RuntimeInitializeOptions): Promise<RuntimeDiagnostics>
  generate(options: RuntimeGenerateOptions): Promise<RuntimeGenerationResult>
  reset(): Promise<void>
  dispose(): Promise<void>
  exportDiagnostics(): string
}
