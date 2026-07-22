import type { LocalAiRuntime, ModelManifestEntry, RuntimeGenerationResult } from '../runtime'

export interface BenchmarkRun {
  kind: 'cold' | 'warm'
  initializationMs?: number
  firstTokenMs?: number
  tokensPerSecond?: number
  totalGenerationMs: number
  finishReason: RuntimeGenerationResult['finishReason']
}

export interface RuntimeBenchmarkReport {
  modelId: string
  requestedAccelerator: Parameters<LocalAiRuntime['initialize']>[0]['acceleratorPreference']
  actualAccelerator?: string
  fallbackReason?: string
  runs: BenchmarkRun[]
}

export async function benchmarkRuntime(
  runtime: LocalAiRuntime,
  model: ModelManifestEntry,
  requestedAccelerator: Parameters<LocalAiRuntime['initialize']>[0]['acceleratorPreference'],
  prompt: string,
  warmRuns = 3,
): Promise<RuntimeBenchmarkReport> {
  await runtime.initialize({ model, acceleratorPreference: requestedAccelerator })
  const runs: BenchmarkRun[] = []
  for (let index = 0; index <= warmRuns; index += 1) {
    const startedAt = performance.now()
    const result = await runtime.generate({ input: prompt })
    const diagnostics = runtime.snapshot.diagnostics
    runs.push({
      kind: index === 0 ? 'cold' : 'warm',
      initializationMs: index === 0 ? diagnostics.initializationDurationMs : undefined,
      firstTokenMs: diagnostics.firstTokenLatencyMs,
      tokensPerSecond: diagnostics.generationTokensPerSecond,
      totalGenerationMs: performance.now() - startedAt,
      finishReason: result.finishReason,
    })
  }
  return {
    modelId: model.id,
    requestedAccelerator,
    actualAccelerator: runtime.snapshot.diagnostics.actualAccelerator,
    fallbackReason: runtime.snapshot.diagnostics.fallbackReason,
    runs,
  }
}

