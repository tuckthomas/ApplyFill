# Managed Browser Agent, Vision Runtime, and Backend Restoration

**Proposed:** 2026-07-22  
**Status:** Implemented — release acceptance pending
**Lifecycle:** Implementation is active in `in-progress/`; move to `completed/` only after the remaining release and human gates pass
**Target:** A local/private ApplyFill stack with ASP.NET Core 10, PostgreSQL 18, managed Chromium, and self-hosted vision models

## Product decision proposed

Replace the extension-based autofill architecture with a first-class **Browser Agent** workspace rendered inside ApplyFill's existing main layout. ApplyFill owns a managed Chromium session, streams the live page into the workspace, and lets the user pause, stop, take control, and return control to the agent without changing browser sessions or losing multi-page application progress.

Restore ASP.NET Core 10 and PostgreSQL 18 as the authoritative application backend. Run the browser and AI services locally for the first supported release so ApplyFill still does not possess user profiles, browser cookies, resumes, application answers, screenshots, prompts, or model output. Cloud-hosted multi-user operation is a separate future product decision and is not implied by this plan.

```text
ApplyFill React main layout
  `-- Browser Agent route
        +-- live managed-browser viewport
        +-- pause / stop / take control / return control
        +-- progress, pending questions, and action history
        |
        `-- ASP.NET Core 10 orchestration API + SignalR
              +-- persistent multi-page application state machine
              +-- policy and schema validation
              +-- managed Chromium worker
              +-- Qwen3-VL visual application agent
              +-- PaddleOCR-VL document/resume parser
              `-- PostgreSQL 18 authoritative records and checkpoints
```

## Non-negotiable product boundaries

- [x] Remove the Chromium extension from the target architecture; do not redesign or retain it as the Browser Agent transport.
- [x] Render the Browser Agent within the existing ApplyFill header/sidebar/main-content shell.
- [x] Preserve the same authenticated Chromium context across every page, redirect, popup, conditional branch, and user-control handoff in an application run.
- [x] Let the user pause, stop, take control, and return control at any time from persistent visible controls.
- [x] Make agent and human input mutually exclusive through a server-owned control lease.
- [x] Persist application-run state and checkpoints across page navigation, browser-worker restart, and ApplyFill reload.
- [x] Use visual understanding for page semantics, layout, and unusual controls; combine it with browser-observed structure for deterministic execution and verification.
- [x] Never treat a screenshot-coordinate guess as proof that an action succeeded.
- [x] Keep credentials, MFA, CAPTCHA, legally binding attestations, and missing personal answers under explicit user control.
- [x] Stop for explicit final-submission approval by default. Advancing ordinary intermediate pages must remain automated.
- [x] Keep raw page screenshots, DOM snapshots, browser cookies, uploaded documents, prompts, and generated reasoning out of ordinary logs.
- [x] Run models and browser automation locally for the first release; no silent cloud fallback.
- [x] Treat model implementations as replaceable providers selected by declared capabilities and conformance results; no workflow, API, database, or UI contract may depend directly on a Qwen/Paddle/Ollama-specific type.
- [x] Optimize the first model selection for correctness over latency on the development machine; slower CPU/GPU split inference is acceptable when it produces materially better verified results.
- [x] Keep runtime/provider/model-selection architecture entirely internal. Ordinary users never install, select, configure, connect, or troubleshoot Ollama, llama.cpp, Transformers, Paddle, ports, APIs, containers, quantization, GPU layers, or model identifiers.
- [x] Provide one ordinary setup action—**Set Up Private AI**—that checks the computer, installs the supported runtime/model combination, verifies it, and reports only plain-language progress and actionable failures.
- [ ] ApplyFill automatically chooses and updates the best evaluated compatible model. A model change must not require users to understand that the underlying provider or model changed.
- [x] Eliminate dual authoritative stores after migration. PostgreSQL 18 becomes authoritative; IndexedDB may only participate in an explicit, temporary cutover process.
- [x] Do not retain obsolete extension or browser-local compatibility paths after the cutover is verified.

## Workstream directory

Each checklist is intended to be independently assignable after approval. A workstream may research its own implementation details earlier than its integration dependency, but it must not merge production behavior against an unstable shared contract.

| # | Workstream | Primary ownership | Starts after |
|---|---|---|---|
| 01 | [Architecture and backend foundation](01-architecture-backend-foundation.md) | Solution structure, .NET host, shared contracts, local topology | Approval |
| 02 | [PostgreSQL persistence and data cutover](02-postgresql-persistence-migration.md) | EF Core, PostgreSQL 18, aggregates, migration | Workstream 01 contract skeleton |
| 03 | [Managed browser runtime and streaming](03-managed-browser-runtime-streaming.md) | Playwright/Chromium, streaming, input relay, session lifecycle | Workstream 01 interfaces |
| 04 | [Multi-page agent orchestration](04-multipage-agent-orchestration.md) | State machine, planning loop, recovery, browser actions | Workstreams 01 and 03 contracts |
| 05 | [Vision and document intelligence](05-vision-model-document-pipeline.md) | Qwen3-VL, PaddleOCR-VL, evaluation, inference adapters | Workstream 01 interfaces; evaluation can begin immediately |
| 06 | [Browser Agent UI and control handoff](06-browser-agent-ui-control-handoff.md) | React route, viewport, controls, accessibility | Workstreams 01 and 03 event contracts |
| 07 | [Security, privacy, and safety](07-security-privacy-safety.md) | Threat model, policy engine, encryption, retention | Approval; gates every integration |
| 08 | [Extension retirement and frontend integration](08-extension-retirement-integration.md) | Remove extension/LiteRT paths, API clients, cutover | Workstreams 01–06 usable end-to-end slice |
| 09 | [Verification, deployment, and documentation](09-verification-deployment-documentation.md) | Test matrix, packaging, operational proof, docs/gallery | Harness immediately; final gate after all workstreams |

## Shared contract ownership

- [x] Workstream 01 owns service boundaries, transport envelopes, identifiers, versioning, and solution/package topology.
- [x] Workstream 02 owns persisted aggregates, EF mappings, database migrations, concurrency, and repository contracts.
- [x] Workstream 03 owns browser-session, viewport-frame, user-input, browser-event, and low-level browser-action contracts.
- [x] Workstream 04 owns application-run states, agent decisions, allowed high-level actions, checkpoints, pending questions, and recovery rules.
- [x] Workstream 05 owns model-provider interfaces, visual-observation inputs, structured model outputs, prompt versions, and evaluation artifacts.
- [x] Workstream 06 owns visible UI components and consumes shared contracts without redefining them in page-local types.
- [x] Workstream 07 owns prohibitions and policy decisions. Other workstreams cannot weaken these to make a test or model pass.
- [x] Workstream 08 owns deletion of obsolete extension and browser-only paths after replacements pass acceptance.
- [x] Workstream 09 owns cross-cutting release evidence; each workstream still owns its focused automated tests.

## Integration hotspots and parallel-agent controls

- [x] Assign one integration coordinator before parallel implementation starts.
- [x] Coordinate changes to solution files, root container configuration, `frontend/package.json`, `frontend/pnpm-lock.yaml`, `frontend/src/App.tsx`, `frontend/src/index.css`, `.agents/README.md`, and root `README.md`.
- [x] Keep initial browser and model adapters behind interfaces so deterministic fakes unblock UI and orchestration work.
- [x] Do not let the browser-runtime workstream design application semantics; it executes validated actions from the orchestrator.
- [x] Do not let the model workstream write directly to PostgreSQL or browser sessions.
- [x] Do not let the UI workstream invent a second client-side run state that can diverge from the backend.
- [x] Do not delete the extension or local-first implementation until the replacement vertical slice and data cutover are proven.
- [x] Use short-lived feature branches or non-overlapping file ownership when multiple agents edit in parallel.

## Required implementation order

1. [x] Freeze the shared architecture, threat model, and local deployment topology.
2. [x] Restore the .NET 10 solution and create versioned API/SignalR contracts.
3. [x] Establish PostgreSQL 18, EF Core 10 migrations, ownership, and test infrastructure.
4. [x] Prove one managed Chromium session can stream into a minimal ApplyFill harness and accept exclusive user/agent input.
5. [x] Prove one local vision model can observe a screenshot and return a validated, non-executable page interpretation.
6. [x] Implement the persistent multi-page application-run state machine with fake browser/model adapters.
7. [x] Integrate the real browser, model, and Browser Agent UI for one multi-page synthetic application.
8. [x] Add resume parsing, resume generation/upload, conditional questions, recovery, and user handoffs.
9. [x] Cut authoritative data from IndexedDB to PostgreSQL and remove dual-write paths.
10. [x] Remove the extension, `/autofill-assist`, browser LiteRT model delivery, obsolete settings, and superseded documentation.
11. [ ] Complete security, performance, failure, real-browser, packaging, and documentation gates.

## Milestones and gates

### Gate 0 — plan approval

- [x] User reviews this directory.
- [x] User explicitly authorizes implementation.
- [x] Move the entire directory from `pipeline/` to `in-progress/` before implementation begins.

### Gate 1 — feasibility

- [x] .NET 10 API starts with PostgreSQL 18 and an isolated test database.
- [x] Managed Chromium renders a real multi-page site and retains cookies/session state across navigation.
- [ ] A live viewport is visible within an ApplyFill development route with acceptable local latency.
- [x] User control and agent control can transfer without simultaneous input or session replacement.
- [ ] Qwen3-VL 4B and 8B are benchmarked on the development RTX 2070 (8 GB, compute capability 7.5) with 32 GB system RAM; 8B is the preferred quality candidate even when it requires CPU/GPU split inference, while 2B remains a diagnostic fallback.
- [x] PaddleOCR-VL parses a representative two-page, two-column resume on the same RTX 2070 through a CC 7.5-compatible backend.
- [x] Prove Qwen and PaddleOCR can be loaded and unloaded sequentially without requiring both models to fit in VRAM simultaneously.
- [ ] Replace the selected Qwen test model with a second conforming model through configuration/manifest changes only, without editing workflow code or database schemas.

### Gate 2 — persistent multi-page vertical slice

- [x] Start one application run from ApplyFill.
- [ ] Complete at least three distinct pages with a redirect or SPA transition.
- [x] Persist a checkpoint after every material action and navigation.
- [x] Pause, take control, edit a value manually, return control, and continue the same run.
- [x] Recover the run after reloading ApplyFill and after restarting the browser worker.
- [ ] Reach final review without an extension and without per-page user reconnection.

### Gate 3 — data and privacy cutover

- [x] PostgreSQL is the sole authoritative profile, resume, tracker, dashboard, and application-run store.
- [x] Application-layer encryption protects approved high-sensitivity fields with keys outside PostgreSQL.
- [x] Screenshots and transient page observations expire and are not included in backups by default.
- [x] Existing development data is explicitly imported or deliberately reset; no indefinite legacy reader remains.
- [ ] Backup, restore, migration rollback, and deletion procedures are tested.

### Gate 4 — product completion

- [ ] Resume import, tailored resume selection, file upload, conditional questions, page validation, popup/tab changes, and final-review stopping work end to end.
- [ ] Login, MFA, CAPTCHA, missing-answer, unsupported-control, model-failure, browser-crash, and network-interruption handoffs are understandable and recoverable.
- [ ] The Browser Agent is fully usable with keyboard and screen reader controls in light and dark themes.
- [ ] A non-technical user can install ApplyFill, select **Set Up Private AI**, start an application, and use pause/stop/take-control without seeing or configuring any model/runtime/provider terminology.
- [x] The extension and obsolete browser-only AI architecture are removed.

### Gate 5 — release acceptance

- [ ] All unit, integration, contract, migration, browser, model-conformance, security, accessibility, and packaging suites pass.
- [ ] A human completes representative applications in a release-like local installation without submitting unintended applications.
- [ ] Documentation and gallery screenshots show the shipped Browser Agent, control handoff, progress, and final review.
- [x] Threat model, retention table, model/license inventory, and limitations are current.

## Completion rule

This plan suite is complete only when ApplyFill can start, navigate, pause, hand off, resume, recover, and finish a multi-page application inside its own main layout; PostgreSQL 18 is authoritative; local vision/document models are evaluated and pinned; the extension and obsolete compatibility paths are removed; and release evidence demonstrates privacy, safety, accessibility, and operational recovery. Record the outcome and remaining limitations here before moving the entire directory to `completed/`.

## Implementation outcome

**Outcome:** Implemented — release acceptance pending.

Evidence is recorded in `artifacts/test-matrix.md`, `artifacts/release-verification.md`, `artifacts/model-evaluation.md`, `artifacts/runtime-evaluation.md`, `artifacts/security-review.md`, `artifacts/cutover-inventory.md`, `docs/threat-model.md`, and `docs/data-retention.md`. The verified development build has 122 passing .NET tests, 47 passing frontend tests across 15 files, five passing launcher tests, successful lint/build/format/dependency audits, six PostgreSQL 18 migrations, a managed-browser/synthetic-ATS harness, and a successful real two-column PDF vision import on the RTX 2070.

The suite remains in progress because release acceptance still requires comparative 4B/8B and held-out model metrics, performance/failure-recovery budgets, complete backup/restore/rollback testing, a clean-machine packaged installer/updater/uninstaller, full keyboard/screen-reader/light/dark acceptance, the remaining Browser Agent state screenshots, non-technical-user testing, representative real-site applications, and a manual packaged-build security review.
