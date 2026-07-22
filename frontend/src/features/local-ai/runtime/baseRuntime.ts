import { assertRuntimeTransition } from './lifecycle'
import type {
  LocalAiRuntime,
  RuntimeCapabilities,
  RuntimeDiagnostics,
  RuntimeListener,
  RuntimeSnapshot,
  RuntimeState,
} from './types'

export abstract class BaseLocalAiRuntime implements LocalAiRuntime {
  #snapshot: RuntimeSnapshot = {
    state: 'idle',
    diagnostics: { browserSupported: false, recoverableErrors: [] },
  }
  #listeners = new Set<RuntimeListener>()

  get snapshot(): RuntimeSnapshot {
    return structuredClone(this.#snapshot)
  }

  subscribe(listener: RuntimeListener): () => void {
    this.#listeners.add(listener)
    listener(this.snapshot)
    return () => this.#listeners.delete(listener)
  }

  abstract detectCapabilities(): Promise<RuntimeCapabilities>
  abstract initialize(
    options: Parameters<LocalAiRuntime['initialize']>[0],
  ): ReturnType<LocalAiRuntime['initialize']>
  abstract generate(
    options: Parameters<LocalAiRuntime['generate']>[0],
  ): ReturnType<LocalAiRuntime['generate']>
  abstract reset(): Promise<void>
  abstract dispose(): Promise<void>

  exportDiagnostics(): string {
    return JSON.stringify(
      {
        exportedAt: new Date().toISOString(),
        state: this.#snapshot.state,
        ...this.#snapshot.diagnostics,
      },
      null,
      2,
    )
  }

  protected transition(state: RuntimeState): void {
    assertRuntimeTransition(this.#snapshot.state, state)
    this.#snapshot = { ...this.#snapshot, state }
    this.emit()
  }

  protected replaceDiagnostics(diagnostics: RuntimeDiagnostics): void {
    this.#snapshot = { ...this.#snapshot, diagnostics: structuredClone(diagnostics) }
    this.emit()
  }

  protected updateDiagnostics(diagnostics: Partial<RuntimeDiagnostics>): void {
    this.#snapshot = {
      ...this.#snapshot,
      diagnostics: {
        ...this.#snapshot.diagnostics,
        ...structuredClone(diagnostics),
      },
    }
    this.emit()
  }

  protected recordRecoverableError(code: string, error: unknown): void {
    const message = error instanceof Error ? error.message : String(error)
    this.updateDiagnostics({
      recoverableErrors: [
        ...(this.#snapshot.diagnostics.recoverableErrors ?? []),
        { code, message, recoverable: true, occurredAt: new Date().toISOString() },
      ].slice(-10),
    })
  }

  protected ensureNotDisposed(): void {
    if (this.#snapshot.state === 'disposed') {
      throw new Error('The local AI runtime has been disposed.')
    }
  }

  private emit(): void {
    const snapshot = this.snapshot
    for (const listener of this.#listeners) listener(snapshot)
  }
}
