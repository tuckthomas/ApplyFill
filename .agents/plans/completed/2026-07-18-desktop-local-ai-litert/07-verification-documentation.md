# Workstream G — Verification, Documentation, and Release Evidence

**Status:** Complete; hardware-unavailable cases are dispositioned below rather than reported as passes  
**Depends on:** Can establish harnesses immediately; final acceptance follows all other workstreams  
**Owns:** Cross-cutting evidence, final documentation consistency, and gallery refresh

## Objective

Prove that the local AI architecture is functional, private by construction, accessible, and accurately documented. A successful build alone is insufficient evidence for model quality, acceleration, offline behavior, or data boundaries.

A checked item means either verified or explicitly dispositioned with a limitation. It never means an unavailable NPU, browser, or runtime path was silently treated as tested. Exact evidence is in `artifacts/release-verification.md`.

## Automated verification

- [x] Run and preserve frontend lint, unit tests, production build, and dependency audit.
- [x] Add contract tests for AI-safe projections, structured outputs, tool schemas, and patch application.
- [x] Add runtime tests for accelerator selection, fallback, cancellation, reset, and diagnostic redaction.
- [x] Add storage tests for model manifest metadata without placing large artifacts in normal unit fixtures.
- [x] Add workflow tests for review, acceptance, rejection, stale suggestions, and undo.
- [x] Add extension tests for least-privilege permissions, message authentication, field discovery, previewed fill, sensitive confirmation, and no-submit behavior.
- [x] Add security tests for prompt injection, prohibited-field exclusion, unsafe output, unknown tools, unexpected network calls, and model-integrity failure.
- [x] Add accessibility tests for status announcements, keyboard operation, focus management, dialogs, and error recovery.
- [x] Keep hardware-dependent conformance tests separate from deterministic CI tests and label them clearly.

## Real-browser and hardware matrix

- [x] Test a current Chromium desktop with WebGPU.
- [x] Record WebNN/JSPI/NPU as untested: the host has no NPU and LiteRT-LM.js 0.14 does not expose a WebNN backend for the selected LLM.
- [x] Record WASM LLM fallback as unsupported by the selected official LiteRT-LM.js path; runtime assets are WASM-hosted but inference is WebGPU.
- [x] Record non-Chromium browsers as unsupported for this release rather than claiming cross-browser acceptance.
- [x] Record browser/OS/hardware class, requested accelerator, actual accelerator, model version, initialization time, first-token latency, and generation rate.
- [x] Run repeated initialize/generate/reset sequences without observed unbounded growth; no long-duration thermal claim is made.
- [x] Run offline after initial model acquisition.
- [x] Verify no prompt/profile/model-output requests leave the origin.
- [x] Clearly distinguish unsupported, untested, and failed configurations.

## Product acceptance scenarios

- [x] Download and verify a model with clear size/progress disclosure.
- [x] Analyze a representative job posting locally.
- [x] Generate schema-valid relevant-content selections.
- [x] Generate and review summary/bullet suggestions without unsupported claims.
- [x] Accept selected changes, save the resume, reload, and preserve accepted edits.
- [x] Export PDF and DOCX from the deterministic resume-safe model.
- [x] Cancel active generation without losing edits.
- [x] Remove/reinstall the model without affecting profile/resume data.
- [x] Exercise deterministic fallback/recovery tests plus live cache-write failure, cancellation, reset, cold offline initialization, and static-host failures; hardware-only NPU/device-loss paths remain simulated.
- [x] Inspect and fill a synthetic multi-step application through the extension, review all mappings, and leave final submission to the user.

## Privacy acceptance evidence

- [x] Inspect serialized model inputs for every workflow using synthetic sensitive fixtures.
- [x] Confirm prohibited values never appear in model inputs, tool arguments, diagnostics, errors, or outputs supplied back as context.
- [x] Confirm model and runtime assets are integrity checked.
- [x] Confirm generated output is never rendered as unsanitized HTML.
- [x] Confirm no cloud fallback occurs without a future separately approved design and explicit consent.
- [x] Confirm local inference claims do not imply that IndexedDB itself is encrypted.
- [x] Update the threat model with observed residual risks.

## Documentation updates

- [x] Update the root README product description, privacy model, architecture diagram/table, software tags, prerequisites, commands, limitations, and supported desktop-browser matrix.
- [x] Update `frontend/README.md` with runtime assets, model download behavior, local development flags, accelerator fallback, tests, and build/deployment instructions.
- [x] Add extension development/install instructions, permission rationale, supported-control matrix, and autofill limitations.
- [x] Update `.agents/README.md` with the approved local-AI boundary and final backend status.
- [x] Update `.agents/planning/local-first-data-architecture.md` with model storage, local inference, and AI-safe context boundaries.
- [x] Update `.agents/design/DESIGN.md` with Local AI settings, diagnostics, suggestion review, and accessibility patterns.
- [x] Update `.agents/tasks/task.md` as work is completed.
- [x] Add selected model/runtime license and attribution documentation.
- [x] Remove all stale documentation for retired providers/backend components if the retirement gate passes.
- [x] Document experimental WebNN setup without promising availability or performance.

## README gallery

- [x] Capture real running-application screenshots after the visible implementation is complete.
- [x] Include Local AI model setup/download state.
- [x] Include diagnostics showing actual accelerator and fallback information.
- [x] Include job analysis and resume suggestion review.
- [x] Include accepted suggestions reflected in the resume preview.
- [x] Include the extension's mapping review and completed autofill report using a synthetic application page.
- [x] Capture relevant pages in both light and dark themes where they materially differ.
- [x] Store screenshots under `frontend/public/readme/gallery/` and update captions/alt text.
- [x] Do not use mockups as shipped-product screenshots.

## Release report

- [x] Record exact runtime/package/model versions and artifact hashes.
- [x] Record successful and failed validation commands using the repository's `**SUCCESS**` / `**FAILURE**` convention.
- [x] Record the tested hardware/browser matrix and performance summary.
- [x] Record privacy/security test results and known limitations.
- [x] Record final .NET backend disposition.
- [x] Update the suite README with the implementation outcome.
- [x] Move the complete suite from `in-progress/` to `completed/` only after every applicable acceptance item is verified.
