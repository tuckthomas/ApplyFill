import { describe, expect, it } from 'vitest';
import { createDefaultProfileBuilderState, createLocalProfileDocument } from '../profile/profileBuilder';
import { FakeLocalAiRuntime } from '../local-ai/runtime';
import type { ModelManifestEntry } from '../local-ai/runtime';
import { createLocalAiAutofillProposals } from './localAutofillMapper';

const model: ModelManifestEntry = {
  id: 'test', version: '1', displayName: 'Test', runtime: 'litert-lm-js', runtimeVersion: 'test', format: '.litertlm', contextLimit: 1_024,
  artifact: { url: '/test', byteSize: 1, digest: `sha256-${'0'.repeat(64)}` }, supportedAccelerators: ['wasm'],
  license: { name: 'test', url: 'https://example.test', attribution: 'test', redistributionAllowed: false }, approvedTasks: ['test'],
};

describe('local autofill mapper', () => {
  it('accepts only known source and field identifiers', async () => {
    const runtime = new FakeLocalAiRuntime({ response: { text: JSON.stringify({ proposals: [{ fieldId: 'field-1', sourceKey: 'profile.email', confidence: 0.9, reason: 'Ambiguous work email label.' }], generatedValues: [] }), toolCalls: [], finishReason: 'completed' } });
    await runtime.initialize({ model, acceleratorPreference: 'wasm' });
    const result = await createLocalAiAutofillProposals({ runtime, profile: createLocalProfileDocument(createDefaultProfileBuilderState()), fields: [{ id: 'field-1', control: 'input', label: 'Preferred work email', required: false, options: [] }], values: [{ sourceKey: 'profile.email', semantic: 'email', displayLabel: 'Email', value: 'ada@example.test' }] });
    expect(result.proposals).toHaveLength(1);
    expect(result.proposals[0].classification).toBe('model-suggested');
  });

  it('rejects model references to unknown profile data', async () => {
    const runtime = new FakeLocalAiRuntime({ response: { text: JSON.stringify({ proposals: [{ fieldId: 'field-1', sourceKey: 'profile.ssn', confidence: 1, reason: 'unsafe' }], generatedValues: [] }), toolCalls: [], finishReason: 'completed' } });
    await runtime.initialize({ model, acceleratorPreference: 'wasm' });
    await expect(createLocalAiAutofillProposals({ runtime, profile: createLocalProfileDocument(createDefaultProfileBuilderState()), fields: [{ id: 'field-1', control: 'input', label: 'Question', required: false, options: [] }], values: [] })).rejects.toThrow('unknown field or profile source');
  });
});
