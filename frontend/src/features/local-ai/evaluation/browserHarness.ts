import { loadDeployedModelManifest } from '../models/catalog'
import { localAiRuntime } from '../runtime'
import { benchmarkRuntime, type RuntimeBenchmarkReport } from './benchmark'

export interface PackagedModelBenchmarkOptions {
  warmRuns?: number
  prompt?: string
}

/**
 * Browser-only hardware harness. In Vite development tools run:
 *
 * const h = await import('/src/features/local-ai/evaluation/browserHarness.ts')
 * await h.runPackagedModelBenchmark()
 */
export async function runPackagedModelBenchmark(
  options: PackagedModelBenchmarkOptions = {},
): Promise<RuntimeBenchmarkReport> {
  const manifest = await loadDeployedModelManifest()
  const model = manifest.models.find((candidate) => candidate.approvedTasks.includes('evaluation'))
  if (!model) {
    throw new Error('No packaged evaluation model was found. Run `pnpm model:prepare` first.')
  }
  return benchmarkRuntime(
    localAiRuntime,
    model,
    'automatic',
    options.prompt ??
      'Return JSON with one key named status and the exact string value local-ai-ready.',
    options.warmRuns ?? 2,
  )
}

