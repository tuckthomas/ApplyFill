import type {
  AcceleratorId,
  AcceleratorPreference,
  RuntimeCapabilities,
} from './types'

export interface AcceleratorAttemptSuccess {
  ok: true
  actualAccelerator: AcceleratorId
}

export interface AcceleratorAttemptFailure {
  ok: false
  reason: string
}

export type AcceleratorAttemptResult = AcceleratorAttemptSuccess | AcceleratorAttemptFailure

export interface AcceleratorSelectionResult extends AcceleratorAttemptSuccess {
  fallbackReason?: string
}

const preferenceOrder: Record<AcceleratorPreference, AcceleratorId[]> = {
  automatic: ['webgpu', 'webnn-npu', 'wasm'],
  'experimental-npu': ['webnn-npu'],
  webgpu: ['webgpu'],
  wasm: ['wasm'],
}

export function compatibleAccelerators(
  capabilities: RuntimeCapabilities,
  preference: AcceleratorPreference,
  supportedAccelerators: readonly AcceleratorId[],
): AcceleratorId[] {
  return preferenceOrder[preference].filter((accelerator) =>
    supportedAccelerators.includes(accelerator) && capabilities.accelerators[accelerator].available)
}

export async function selectAccelerator(
  capabilities: RuntimeCapabilities,
  preference: AcceleratorPreference,
  attempt: (accelerator: AcceleratorId) => Promise<AcceleratorAttemptResult>,
  supportedAccelerators?: readonly AcceleratorId[],
): Promise<AcceleratorSelectionResult> {
  const failures: string[] = []

  for (const accelerator of preferenceOrder[preference]) {
    if (supportedAccelerators && !supportedAccelerators.includes(accelerator)) continue
    const capability = capabilities.accelerators[accelerator]
    if (!capability.available) {
      failures.push(`${accelerator}: ${capability.detail ?? capability.failureCode ?? 'unavailable'}`)
      continue
    }

    const result = await attempt(accelerator)
    if (result.ok) {
      return {
        ...result,
        fallbackReason: failures.length > 0 ? failures.join(' ') : undefined,
      }
    }
    failures.push(`${accelerator}: ${result.reason}`)
  }

  throw new Error(
    `No compatible local AI accelerator could be initialized. ${failures.join(' ')}`.trim(),
  )
}
