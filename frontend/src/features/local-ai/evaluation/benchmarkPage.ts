import { localAiRuntime } from '../runtime'
import { runPackagedModelBenchmark } from './browserHarness'
import { evaluateLocalAiRuntime } from './evaluation'

const button = document.querySelector<HTMLButtonElement>('#run-benchmark')
const status = document.querySelector<HTMLElement>('#status')
const result = document.querySelector<HTMLElement>('#result')

document.documentElement.dataset.browserUserAgent = navigator.userAgent

if (!button || !status || !result) throw new Error('Hardware harness markup is incomplete.')

localAiRuntime.subscribe((snapshot) => {
  status.textContent = JSON.stringify(
    {
      state: snapshot.state,
      requested: snapshot.diagnostics.desiredAccelerator,
      actual: snapshot.diagnostics.actualAccelerator,
      fallback: snapshot.diagnostics.fallbackReason,
      progressErrors: snapshot.diagnostics.recoverableErrors,
    },
    null,
    2,
  )
})

button.addEventListener('click', async () => {
  button.disabled = true
  result.textContent = 'Benchmark running. The first model compilation can take several minutes.'
  try {
    const report = await runPackagedModelBenchmark()
    const evaluation = await evaluateLocalAiRuntime(localAiRuntime)
    result.textContent = JSON.stringify({ benchmark: report, evaluation }, null, 2)
  } catch (error) {
    result.textContent = JSON.stringify(
      { error: error instanceof Error ? error.message : String(error) },
      null,
      2,
    )
  } finally {
    button.disabled = false
  }
})
