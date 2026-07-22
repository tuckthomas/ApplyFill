import type { RuntimeState } from './types'

const allowedTransitions: Record<RuntimeState, ReadonlySet<RuntimeState>> = {
  unsupported: new Set(['idle', 'disposed']),
  idle: new Set(['unsupported', 'downloading', 'compiling', 'failed', 'disposed']),
  downloading: new Set(['idle', 'compiling', 'failed', 'disposed']),
  compiling: new Set(['idle', 'ready', 'failed', 'disposed']),
  ready: new Set(['idle', 'downloading', 'running', 'failed', 'disposed']),
  running: new Set(['ready', 'failed', 'disposed']),
  failed: new Set(['idle', 'downloading', 'compiling', 'disposed']),
  disposed: new Set(),
}

export class InvalidRuntimeTransitionError extends Error {
  constructor(from: RuntimeState, to: RuntimeState) {
    super(`Illegal local AI runtime transition: ${from} -> ${to}`)
    this.name = 'InvalidRuntimeTransitionError'
  }
}

export function assertRuntimeTransition(from: RuntimeState, to: RuntimeState): void {
  if (from === to) return
  if (!allowedTransitions[from].has(to)) {
    throw new InvalidRuntimeTransitionError(from, to)
  }
}

