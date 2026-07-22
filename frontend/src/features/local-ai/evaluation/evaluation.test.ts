import { describe, expect, it } from 'vitest'
import { FakeLocalAiRuntime } from '../runtime'
import type { ModelManifestEntry, RuntimeCapabilities } from '../runtime'
import { evaluationCorpus } from './corpus'
import { evaluateLocalAiRuntime, scoreEvaluationCase } from './evaluation'

const completeOutput = (factIds: string[]) =>
  JSON.stringify({
    selectedFactIds: factIds,
    claims: factIds.map((factId) => ({ factId, text: `Supported ${factId}` })),
    summary: 'Only supported experience is included.',
    ignoredPostingInstructions: true,
  })

describe('model evaluation harness', () => {
  it('scores supported selection, tool use, and injection resistance', () => {
    const testCase = evaluationCorpus[3]
    const result = scoreEvaluationCase(testCase, completeOutput(testCase.expectedFactIds), [
      { name: 'select_profile_facts', arguments: { factIds: testCase.expectedFactIds } },
    ])
    expect(result).toMatchObject({
      schemaValid: true,
      unsupportedClaimCount: 0,
      selectionPrecision: 1,
      selectionRecall: 1,
      promptInjectionResisted: true,
      toolCallAccurate: true,
    })
  })

  it('rejects malformed and invented output', () => {
    const malformed = scoreEvaluationCase(evaluationCorpus[0], 'not json', [])
    expect(malformed.schemaValid).toBe(false)

    const invented = scoreEvaluationCase(
      evaluationCorpus[0],
      JSON.stringify({
        selectedFactIds: ['invented'],
        claims: [{ factId: 'invented', text: 'ten years of engineering experience' }],
        summary: 'Invented',
        ignoredPostingInstructions: false,
      }),
      [],
    )
    expect(invented.unsupportedClaimCount).toBe(1)
    expect(invented.selectionRecall).toBe(0)
  })

  it('produces a reproducible aggregate report', async () => {
    const testCase = evaluationCorpus[0]
    const capabilities: RuntimeCapabilities = {
      secureContext: true,
      jspi: true,
      crossOriginIsolated: false,
      sharedArrayBuffer: false,
      accelerators: {
        'webnn-npu': { available: false, experimental: true },
        'webnn-gpu': { available: false, experimental: true },
        'webnn-cpu': { available: false, experimental: true },
        webgpu: { available: true, experimental: false },
        wasm: { available: true, experimental: false },
      },
    }
    const runtime = new FakeLocalAiRuntime({
      capabilities,
      response: {
        text: completeOutput(testCase.expectedFactIds),
        toolCalls: [{ name: 'select_profile_facts', arguments: {} }],
        finishReason: 'tool-call',
      },
    })
    const model: ModelManifestEntry = {
      id: 'fake',
      version: '1',
      displayName: 'Fake',
      runtime: 'litert-lm-js',
      runtimeVersion: '0.14.0',
      format: '.litertlm',
      contextLimit: 1_024,
      artifact: {
        url: '/fake',
        byteSize: 1,
        digest: `sha256-${'0'.repeat(64)}`,
      },
      supportedAccelerators: ['webgpu'],
      license: {
        name: 'Synthetic',
        url: 'https://example.invalid',
        attribution: 'Test',
        redistributionAllowed: false,
      },
      approvedTasks: ['test'],
    }
    await runtime.initialize({ model, acceleratorPreference: 'automatic' })
    const report = await evaluateLocalAiRuntime(runtime, [testCase])
    expect(report).toMatchObject({ sampleSize: 1, schemaValidRate: 1, passed: true })
  })
})

