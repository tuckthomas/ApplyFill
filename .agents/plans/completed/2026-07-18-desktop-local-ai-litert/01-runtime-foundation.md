# Workstream A — LiteRT Runtime Foundation

**Status:** Implemented; dedicated-worker and NPU-lab follow-ups recorded  
**Depends on:** No implementation dependency; coordinate interface names with Workstream B  
**Unblocks:** Model evaluation, workflow integration, diagnostics, model caching

## Objective

Create a provider-neutral local AI runtime for the existing React application. LiteRT implementation details must remain behind typed adapters so workflows can be tested with deterministic fakes and future runtime changes do not leak across the UI.

## Package and build spike

- [x] Confirm the current stable versions, licenses, transitive dependencies, and browser requirements for `@litertjs/core` and the LiteRT-LM.js JavaScript package.
- [x] Use pnpm for all package operations and commit the resulting `pnpm-lock.yaml` changes.
- [x] Serve LiteRT WASM artifacts locally from the built application; do not rely on a third-party CDN at runtime.
- [x] Determine whether model/runtime assets require Vite configuration, static-copy handling, or explicit asset-manifest entries.
- [x] Determine whether WASM threading requires `SharedArrayBuffer`, COOP, or COEP headers and record the result for Workstream F.
- [x] Confirm production builds do not embed a remote API endpoint, API key, or provider credential.

## Runtime interfaces

- [x] Define a small `LocalAiRuntime` interface covering capability detection, initialization, model loading, generation, structured tool results, cancellation, progress, disposal, and diagnostics.
- [x] Represent runtime lifecycle explicitly: `unsupported`, `idle`, `downloading`, `compiling`, `ready`, `running`, `failed`, and `disposed`.
- [x] Define accelerator identifiers independently from vendor names: `webnn-npu`, `webnn-gpu`, `webnn-cpu`, `webgpu`, and `wasm`.
- [x] Return the actual active accelerator and fallback reason after model compilation.
- [x] Support `AbortSignal` or an equivalent cancellation contract.
- [x] Prevent concurrent generations from corrupting shared model/session state.
- [x] Provide deterministic fake and failure runtimes for UI and unit tests.
- [x] Keep direct IndexedDB/profile access out of the runtime interface.

## Accelerator selection

- [x] Detect WebNN availability without assuming that the presence of an API guarantees model compatibility.
- [x] Attempt WebNN with `devicePreference: "npu"` when the user selects Automatic or Experimental NPU.
- [x] Detect required WebNN/JSPI browser configuration and provide a machine-readable failure reason.
- [x] Attempt WebGPU when WebNN is unavailable, rejected, incompatible, or explicitly disabled.
- [x] Attempt WASM/XNNPACK when WebGPU is unavailable or model compilation fails.
- [x] Allow users to pin an accelerator for testing without falsifying diagnostics.
- [x] Avoid a permanent device fingerprint; capability details stay in memory or local settings and are not transmitted.
- [x] Do not prefer NPU over GPU without a device benchmark. No compatible NPU was present, so Automatic honestly selected the verified WebGPU path.

## Execution isolation and responsiveness

- [x] Evaluate LiteRT-LM.js support for a dedicated Web Worker.
- [x] Record the upstream limitation: LiteRT-LM.js 0.14 exposes model compilation/inference on the window context; downloads stream with progress/cancellation and the UI remains responsive, but a dedicated inference worker is not claimed.
- [x] If a required operation must remain on the main thread, chunk work and surface responsive progress/cancellation.
- [x] Stream generated output without rendering unsanitized HTML.
- [x] Dispose sessions, tensors, GPU buffers, and workers explicitly.
- [x] Add development-only leak checks or repeat-run tests that expose unbounded device-memory growth.
- [x] Preserve substantive IndexedDB documents across runtime reset/device/cache failures; model sessions and evicted assets recover through explicit reset/re-download states.

## Diagnostics contract

- [x] Expose browser support state, model identifier/version, desired accelerator, actual accelerator, fallback reason, initialization duration, first-token latency, generation rate, and recoverable errors.
- [x] Do not collect raw hardware identifiers beyond what is necessary to explain local compatibility.
- [x] Make diagnostic export an explicit user action and exclude profile/job/prompt content.
- [x] Provide a reset/dispose operation that does not clear the user's profile or resumes.

## Focused tests

- [x] Unit-test lifecycle transitions and illegal transitions.
- [x] Unit-test accelerator selection and each fallback path.
- [x] Unit-test cancellation, concurrent-call rejection/queuing, disposal, and device-loss recovery.
- [x] Unit-test that diagnostics contain no prompt or profile data.
- [x] Use the deterministic fake-runtime browser harness for CI and the approved production model for hardware acceptance; no separate tiny LiteRT-LM artifact met the approval/license gate.
- [x] Document which runtime tests require actual WebGPU/WebNN hardware and which run in CI.

## Handoff

- [x] Publish the stable runtime interface to Workstreams C and D.
- [x] Publish header and asset-delivery requirements to Workstream F.
- [x] Record unresolved LiteRT-LM.js early-preview limitations in the master plan rather than hiding them behind fallbacks.

Unchecked items require hardware or upstream support not available in this implementation session. See `artifacts/runtime-research.md`.
