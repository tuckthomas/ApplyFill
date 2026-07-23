# Workstream D — Local Resume AI Workflows

> **ARCHIVED AND SUPERSEDED — 2026-07-22:** This workstream records historical browser LiteRT workflows. Current resume AI uses backend provider interfaces and PostgreSQL-backed records; this file is not current implementation guidance. See [current architecture](../../../../docs/architecture.md).

> **Superseded UI note (2026-07-22):** Accelerator selection was removed from user-facing Settings. The approved model supports WebGPU only, so ApplyFill now checks compatibility before downloading and selects the working backend automatically. Experimental WebNN/NPU remains developer-facing.

**Status:** Implemented behind the approved-model gate; live candidate quality/hardware acceptance pending Workstream C  
**Depends on:** Workstream B contracts; may begin with Workstream A's fake runtime  
**Primary UI:** Resume builder and Local AI settings/diagnostics integration points

## Objective

Add user-directed local AI assistance without turning the model into the source of truth. Every result is a suggestion derived from an explicit, reviewable snapshot. Deterministic application logic continues to render and export documents.

## Initial workflow sequence

- [x] Start with job-posting analysis that extracts role, employer, responsibilities, required skills, preferred skills, and keywords into a validated schema.
- [x] Add relevance analysis that ranks only the user-selected experience, project, education, and skill records.
- [x] Add professional-summary suggestions based on the approved AI-safe snapshot.
- [x] Add bullet rewrite suggestions that preserve facts and operate on one selected source bullet/group at a time.
- [x] Add a combined resume-tailoring review only after the smaller workflows meet quality thresholds.
- [x] Defer application-question generation until resume workflows and security fixtures are stable.
- [x] Do not add autonomous application submission or arbitrary page access.

## Suggestion lifecycle

- [x] Capture the source document revision used for generation.
- [x] Display the exact source sections shared with local AI in a preflight summary.
- [x] Provide download/model initialization progress before generation begins.
- [x] Stream status/output accessibly without shifting the page uncontrollably.
- [x] Present before/after differences for every proposed text change.
- [x] Allow accept individually, accept selected, reject, regenerate, edit, cancel, and undo.
- [x] Detect stale suggestions if the underlying profile/resume changes before acceptance.
- [x] Apply accepted changes through existing resume document functions, never directly from the runtime.
- [x] Save only accepted changes by default; do not persist raw prompt/session history.

## Resume-builder integration

- [x] Add an explicit `Tailor with local AI` entry point rather than silently running on page load.
- [x] Require pasted/imported job text or an already stored job-application description; do not fetch a job URL from the browser without a separate approved feature.
- [x] Let the user choose the resume sections eligible for analysis.
- [x] Keep contact information outside model context and unchanged by AI suggestions.
- [x] Maintain compatibility with the existing live preview, PDF, DOCX, and JSON flows.
- [x] Preserve the current explicit resume-safe renderer allowlist.
- [x] Warn when a suggestion adds a claim not supported by the supplied source and block known unsupported references.

## Local AI controls

- [x] Add Settings controls for model download, update, remove, and storage usage.
- [x] Add accelerator preference: Automatic, Experimental NPU, GPU, and CPU.
- [x] Explain in plain language that NPU means a dedicated local AI processor and WebNN is the browser path to it.
- [x] Show the requested and actual accelerator plus fallback reason.
- [x] Add a user-initiated local benchmark and compatibility test.
- [x] Add a diagnostics view/export that contains no profile, job, prompt, or generated text.
- [x] Explain that local inference does not encrypt the user's IndexedDB records.
- [x] On unsupported mobile devices, keep non-AI features available and explain that local AI is currently desktop-targeted.

## Accessibility and design

- [x] Read `.agents/design/DESIGN.md` and reuse existing primitives and tokens.
- [x] Do not use `text-xs` classes.
- [x] Make progress, errors, downloads, and fallbacks available to assistive technology without excessive announcements.
- [x] Keep all actions keyboard operable with visible focus.
- [x] Do not communicate accelerator state using color alone.
- [x] Respect reduced motion for streaming/progress effects.
- [x] Prevent long model names and diagnostic values from breaking responsive layouts.
- [x] Verify light and dark themes in the running application.

## Failure and recovery states

- [x] Handle unsupported browser, missing WebNN flags, no WebGPU, insufficient storage, failed integrity, interrupted download, compile failure, out-of-memory, device loss, cancellation, and invalid model output.
- [x] Preserve unsaved resume edits when AI initialization or generation fails.
- [x] Offer the next local fallback without implying data will be sent remotely.
- [x] Never silently invoke a cloud or .NET provider.
- [x] Allow model/runtime reset independently of `Delete all local data`.

## Focused tests

- [x] Component-test the core generate/review/accept lifecycle and invalid-output recovery with fake runtimes; runtime lifecycle/error states are covered in `runtime.test.ts`.
- [x] Test stale-suggestion detection and acceptance/undo behavior through revision/immutable patch contracts and component acceptance tests.
- [x] Test that model suggestions cannot change prohibited/contact fields.
- [x] Test job text as plain text and reject unsafe rendering.
- [x] Test keyboard and screen-reader semantics for the review flow.
- [x] Browser-test model management, accelerator display, tailoring, cancellation, accepted edits, PDF, and DOCX.

## Handoff

- [x] Provide final visible copy and routes/components to Workstream G.
- [x] Identify every remaining UI/API reference to remote AI for the Workstream F retirement audit.

## Implementation evidence

- Resume workflow and review: `frontend/src/components/resume/LocalAiTailoringPanel.tsx`
- Workflow runner: `frontend/src/features/local-ai/workflows/resumeTailoring.ts`
- Settings and diagnostics: `frontend/src/pages/Settings.tsx`
- Tests: `LocalAiTailoringPanel.test.tsx`, `resumeTailoring.test.ts`, and `contracts/*.test.ts`
- Running-browser QA: Settings verified in light/dark themes, a narrow responsive viewport, and with the compatibility control reporting WebGPU/WASM. No application-origin console errors were observed.
- Remaining acceptance gates: combined tailoring stays blocked until Workstream C approves a model for `resume-tailoring`; full live-model browser tests for tailoring, PDF, and DOCX remain unchecked below.
