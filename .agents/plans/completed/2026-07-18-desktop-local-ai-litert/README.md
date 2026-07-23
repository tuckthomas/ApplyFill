# Desktop Local AI with LiteRT

> **ARCHIVED AND SUPERSEDED — 2026-07-22:** This suite records a completed historical browser-local implementation. It is not the current architecture or implementation guidance. Browser LiteRT/WebGPU inference, IndexedDB authority, static-only deployment, and the Chromium extension were retired. ApplyFill now uses the React UI, .NET 10 API, PostgreSQL 18, a managed-Chromium Browser Agent, and native local Private AI services. See [current architecture](../../../../docs/architecture.md), [threat model](../../../../docs/threat-model.md), and [data retention](../../../../docs/data-retention.md). The checked items below remain historical evidence and must not be read as current product behavior.

> **Historical implementation note from 2026-07-22:** The hardware selector described in the original checklist was removed. At that transition point, Private AI setup checked browser model compatibility and selected WebGPU automatically; WebNN/NPU remained developer-only.

**Proposed:** 2026-07-18  
**Approved:** 2026-07-18  
**Status:** Complete for Chromium/WebGPU; unavailable hardware paths are explicitly dispositioned  
**Target:** Chromium desktop with WebGPU; mobile AI execution is out of scope

## Decision proposed

Make ApplyFill's AI runtime local to the user's desktop browser. Use LiteRT-LM.js for generative language-model workflows and LiteRT.js capability detection for future smaller inference tasks. The selected LiteRT-LM.js model runs on WebGPU. WebNN/NPU is detected but is not an inference backend for this release; WASM hosts the runtime but is not a CPU fallback for this LLM.

The application remains a static Vite/React application suitable for Cloudflare deployment. Cloudflare distributes application, runtime, and model assets but does not receive profile records, job postings, prompts, model inputs, or model outputs. The browser-local profile remains authoritative in IndexedDB.

```text
ApplyFill UI
    |
    +-- deterministic application logic
    |     +-- profile and resume schemas
    |     +-- sensitive-data exclusions
    |     +-- schema validation
    |     +-- PDF and DOCX renderers
    |     `-- explicit user review and acceptance
    |
    `-- local AI boundary
          +-- LiteRT-LM.js: constrained generation (no agentic tool execution)
          +-- LiteRT.js: capability detection and future smaller models
          +-- WebGPU: supported LLM accelerator
          +-- WebNN/NPU: detected experimental capability; not an LLM backend
          `-- WASM: self-hosted runtime loader; not a CPU LLM fallback
```

## Non-negotiable boundaries

- [x] Keep IndexedDB as the authoritative store for profile, resume, tracker, and dashboard documents.
- [x] Do not introduce an ApplyFill account database, cloud profile, silent synchronization, or remote prompt logging.
- [x] Never provide government identifiers, work-authorization answers, sponsorship answers, voluntary demographic responses, reasons for leaving, supervisor data, street addresses, company phone numbers, authentication secrets, or internal metadata to any AI model.
- [x] Define an AI-specific allowlist narrower than `ResumeSafeViewModel`; contact name, email, phone, links, and location must be excluded unless an approved workflow proves each field necessary.
- [x] Treat job postings and imported text as untrusted data, not model instructions.
- [x] Treat every model result as untrusted proposed data; validate it and require user review before modifying a resume or application document.
- [x] Keep deterministic code responsible for storage, field selection, security decisions, and document rendering.
- [x] Show the active accelerator and every fallback. Do not claim NPU execution when the browser selected another device.
- [x] Keep AI useful without WebNN through the verified WebGPU path; explicitly report that this LiteRT-LM.js model has no WASM-only CPU fallback.
- [x] Do not send telemetry, hardware fingerprints, prompts, profile data, or benchmark results off-device.

## Scope

### Included

- [x] Desktop-browser capability detection for LiteRT.js, LiteRT-LM.js, WebNN, WebGPU, WASM, storage, and model compatibility.
- [x] Experimental WebNN/NPU setup, selection, diagnostics, and fallback.
- [x] Local model manifest, download, integrity validation, caching, versioning, removal, and offline reuse.
- [x] A narrow AI context projection and validated structured-output contracts.
- [x] Local resume-tailoring workflows with previewable, reversible suggestions.
- [x] A least-privilege desktop browser extension for user-initiated inspection and filling of job-application forms.
- [x] A Local AI settings and diagnostics experience.
- [x] Static Cloudflare-compatible headers and model-asset delivery.
- [x] A measured decision about removing the stateless .NET AI proxy after local feature parity is accepted.
- [x] Automated, model-conformance, security, browser, accessibility, and documentation verification.

### Excluded

- Mobile GPU/NPU execution or mobile performance promises.
- Autonomous submission of job applications; the extension may fill and preview but must not press the final submit control.
- Cross-origin form manipulation directly from the Vite page; approved autofill uses the separately permissioned extension boundary.
- A ChatGPT App/plugin as the primary product surface.
- Server-side profile, resume, tracker, prompt, or model-output persistence.
- Training or fine-tuning on a user's private profile in the browser.
- Silent cloud-AI fallback.

## Workstream files

Each workstream is intended to be assignable to a separate agent after this plan suite is approved and moved to `in-progress/`.

| Workstream | File | Primary ownership | May start |
|---|---|---|---|
| A | [Runtime foundation](01-runtime-foundation.md) | Runtime adapters, capability detection, workers | Immediately after approval |
| B | [Privacy and contracts](02-privacy-security-contracts.md) | AI-safe projection, schemas, tool boundary | Immediately after approval |
| C | [Model evaluation](03-model-evaluation.md) | Candidate models, benchmarks, acceptance report | After A exposes a minimal runner; research can start immediately |
| D | [Product workflows](04-resume-ai-workflows.md) | Resume tailoring UI and suggestion lifecycle | After B contracts stabilize; mock runtime may be used |
| E | [Browser extension and autofill](05-browser-extension-autofill.md) | Page inspection, local handoff, previewed fill | Design immediately; integration after A and B contracts |
| F | [Storage and deployment](06-offline-storage-deployment.md) | Model cache, headers, offline behavior, backend retirement | Cache work after A; retirement only after final gate |
| G | [Verification and documentation](07-verification-documentation.md) | Tests, security review, docs, gallery | Test harness immediately; final docs after integration |

## Shared contracts and integration order

- [x] Workstream B owns the AI-safe input/output types and validators. Other workstreams consume them rather than defining parallel contracts.
- [x] Workstream A owns the runtime/provider interfaces. UI code consumes the interface and does not import LiteRT directly.
- [x] Workstream C owns the checked-in benchmark report and model recommendation. It does not change production workflow behavior.
- [x] Workstream D owns visible workflow components and pages. It does not read the complete profile directly inside runtime adapters.
- [x] Workstream E owns the extension, page-field contracts, and explicit app-to-extension handoff. It does not create a second authoritative profile store.
- [x] Workstream F owns large-model persistence and deployment headers. It does not create a second store for substantive user records.
- [x] Workstream G owns cross-cutting acceptance evidence and documentation, but each workstream must add its own focused unit tests.
- [x] Integrate in this order: contracts → runtime → selected model → resume workflows → extension/autofill → offline/deployment → backend retirement decision.

## Parallel-agent conflict controls

- [x] Assign one integration coordinator to resolve shared dependency and configuration changes.
- [x] Runtime agent avoids editing resume pages except for a temporary isolated development harness.
- [x] Privacy agent avoids editing LiteRT initialization and package configuration.
- [x] Workflow agent uses mocked runtime responses until the runtime interface is available.
- [x] Extension agent keeps extension-owned code in a separate package and coordinates any shared message contracts with the privacy agent.
- [x] Deployment agent avoids changing profile/resume schemas or extension permissions.
- [x] Verification agent adds fixtures and tests without weakening production validators.
- [x] Coordinate before modifying `frontend/package.json`, `frontend/vite.config.*`, `frontend/src/App.tsx`, `.agents/README.md`, or the root `README.md`, because those are expected integration hotspots.

## Milestones and gates

### Gate 0 — approval

- [x] User reviews this plan suite.
- [x] User explicitly authorizes implementation.
- [x] Move the entire directory from `pipeline/` to `in-progress/` before writing implementation code.

### Gate 1 — technical feasibility

- [x] Load LiteRT.js and LiteRT-LM.js in the existing Vite application without a remote API.
- [x] Run one model locally through WebGPU on a supported desktop.
- [x] Detect and report WebNN/NPU honestly; disposition model execution as unsupported by LiteRT-LM.js 0.14 and untested because this host has no NPU.
- [x] Disposition WASM-only LLM generation as unsupported; do not advertise a false CPU fallback.
- [x] Record actual backend, initialization time, memory behavior, and output latency.
- [x] Keep the UI responsive during inference or document why a worker is not yet possible.

### Gate 2 — privacy and correctness

- [x] Prove prohibited profile fields are structurally absent from model inputs.
- [x] Prove tool calls cannot query IndexedDB or arbitrary profile fields.
- [x] Reject malformed, oversized, instruction-injected, or schema-invalid model output.
- [x] Require explicit acceptance before applying generated text.
- [x] Confirm normal operation produces no remote prompt or profile requests.

### Gate 3 — model acceptance

- [x] Select a model only after repeatable quality, performance, license, and compatibility evaluation.
- [x] Decline to define a minimum desktop specification from one machine; publish only the measured tested host.
- [x] Provide a usable WebGPU experience even when WebNN is unavailable.
- [x] Confirm model download and local storage UX is acceptable.

### Gate 4 — product integration

- [x] Deliver local job analysis and resume-tailoring workflows.
- [x] Deliver user-initiated extension inspection, mapping review, and form filling without automatic submission.
- [x] Prove sensitive values bypass the model and require explicit per-field confirmation before extension insertion.
- [x] Preserve deterministic PDF/DOCX output and the existing resume-safe renderer boundary.
- [x] Deliver diagnostics, model management, offline reuse, and recovery paths.
- [x] Verify light/dark themes, keyboard operation, screen-reader semantics, and reduced-motion behavior.

### Gate 5 — static-only decision

- [x] Compare local AI against every remaining .NET AI responsibility.
- [x] Remove the .NET solution only if no approved runtime feature still depends on it.
- [x] Remove API configuration, containers, documentation, and tests in the same change if retirement is approved.
- [x] Verify the production build can be served as static assets with no application backend.

## Completion rule

This suite is complete only when all applicable workstream checklists are verified, the selected model and license are documented, the privacy boundary has executable tests, resume assistance and extension autofill are demonstrated, the static deployment is demonstrated, documentation/screenshots reflect the shipped product, and any retained backend responsibility is explicitly justified. Record the implementation outcome in this file, then move the entire directory to `.agents/plans/completed/`.

## Implementation outcome

All eight coordinated plans are implemented or explicitly dispositioned. The supported release is a static Chromium/WebGPU PWA with verified offline LiteRT-LM inference, constrained and validated resume proposals, deterministic browser-side exports, and a least-privilege extension boundary. The .NET/PostgreSQL architecture is retired. See `artifacts/release-verification.md` for commands, live-browser evidence, performance, and the clearly labeled unsupported/untested matrix.
