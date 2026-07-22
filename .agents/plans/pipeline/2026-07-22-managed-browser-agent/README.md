# Managed Browser Agent, Vision Runtime, and Backend Restoration

**Proposed:** 2026-07-22  
**Status:** Pipeline — awaiting review and explicit approval  
**Lifecycle:** Move this entire directory to `in-progress/` only after the user instructs implementation to begin  
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

- [ ] Remove the Chromium extension from the target architecture; do not redesign or retain it as the Browser Agent transport.
- [ ] Render the Browser Agent within the existing ApplyFill header/sidebar/main-content shell.
- [ ] Preserve the same authenticated Chromium context across every page, redirect, popup, conditional branch, and user-control handoff in an application run.
- [ ] Let the user pause, stop, take control, and return control at any time from persistent visible controls.
- [ ] Make agent and human input mutually exclusive through a server-owned control lease.
- [ ] Persist application-run state and checkpoints across page navigation, browser-worker restart, and ApplyFill reload.
- [ ] Use visual understanding for page semantics, layout, and unusual controls; combine it with browser-observed structure for deterministic execution and verification.
- [ ] Never treat a screenshot-coordinate guess as proof that an action succeeded.
- [ ] Keep credentials, MFA, CAPTCHA, legally binding attestations, and missing personal answers under explicit user control.
- [ ] Stop for explicit final-submission approval by default. Advancing ordinary intermediate pages must remain automated.
- [ ] Keep raw page screenshots, DOM snapshots, browser cookies, uploaded documents, prompts, and generated reasoning out of ordinary logs.
- [ ] Run models and browser automation locally for the first release; no silent cloud fallback.
- [ ] Treat model implementations as replaceable providers selected by declared capabilities and conformance results; no workflow, API, database, or UI contract may depend directly on a Qwen/Paddle/Ollama-specific type.
- [ ] Optimize the first model selection for correctness over latency on the development machine; slower CPU/GPU split inference is acceptable when it produces materially better verified results.
- [ ] Keep runtime/provider/model-selection architecture entirely internal. Ordinary users never install, select, configure, connect, or troubleshoot Ollama, llama.cpp, Transformers, Paddle, ports, APIs, containers, quantization, GPU layers, or model identifiers.
- [ ] Provide one ordinary setup action—**Set Up Private AI**—that checks the computer, installs the supported runtime/model combination, verifies it, and reports only plain-language progress and actionable failures.
- [ ] ApplyFill automatically chooses and updates the best evaluated compatible model. A model change must not require users to understand that the underlying provider or model changed.
- [ ] Eliminate dual authoritative stores after migration. PostgreSQL 18 becomes authoritative; IndexedDB may only participate in an explicit, temporary cutover process.
- [ ] Do not retain obsolete extension or browser-local compatibility paths after the cutover is verified.

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

- [ ] Workstream 01 owns service boundaries, transport envelopes, identifiers, versioning, and solution/package topology.
- [ ] Workstream 02 owns persisted aggregates, EF mappings, database migrations, concurrency, and repository contracts.
- [ ] Workstream 03 owns browser-session, viewport-frame, user-input, browser-event, and low-level browser-action contracts.
- [ ] Workstream 04 owns application-run states, agent decisions, allowed high-level actions, checkpoints, pending questions, and recovery rules.
- [ ] Workstream 05 owns model-provider interfaces, visual-observation inputs, structured model outputs, prompt versions, and evaluation artifacts.
- [ ] Workstream 06 owns visible UI components and consumes shared contracts without redefining them in page-local types.
- [ ] Workstream 07 owns prohibitions and policy decisions. Other workstreams cannot weaken these to make a test or model pass.
- [ ] Workstream 08 owns deletion of obsolete extension and browser-only paths after replacements pass acceptance.
- [ ] Workstream 09 owns cross-cutting release evidence; each workstream still owns its focused automated tests.

## Integration hotspots and parallel-agent controls

- [ ] Assign one integration coordinator before parallel implementation starts.
- [ ] Coordinate changes to solution files, root container configuration, `frontend/package.json`, `frontend/pnpm-lock.yaml`, `frontend/src/App.tsx`, `frontend/src/index.css`, `.agents/README.md`, and root `README.md`.
- [ ] Keep initial browser and model adapters behind interfaces so deterministic fakes unblock UI and orchestration work.
- [ ] Do not let the browser-runtime workstream design application semantics; it executes validated actions from the orchestrator.
- [ ] Do not let the model workstream write directly to PostgreSQL or browser sessions.
- [ ] Do not let the UI workstream invent a second client-side run state that can diverge from the backend.
- [ ] Do not delete the extension or local-first implementation until the replacement vertical slice and data cutover are proven.
- [ ] Use short-lived feature branches or non-overlapping file ownership when multiple agents edit in parallel.

## Required implementation order

1. [ ] Freeze the shared architecture, threat model, and local deployment topology.
2. [ ] Restore the .NET 10 solution and create versioned API/SignalR contracts.
3. [ ] Establish PostgreSQL 18, EF Core 10 migrations, ownership, and test infrastructure.
4. [ ] Prove one managed Chromium session can stream into a minimal ApplyFill harness and accept exclusive user/agent input.
5. [ ] Prove one local vision model can observe a screenshot and return a validated, non-executable page interpretation.
6. [ ] Implement the persistent multi-page application-run state machine with fake browser/model adapters.
7. [ ] Integrate the real browser, model, and Browser Agent UI for one multi-page synthetic application.
8. [ ] Add resume parsing, resume generation/upload, conditional questions, recovery, and user handoffs.
9. [ ] Cut authoritative data from IndexedDB to PostgreSQL and remove dual-write paths.
10. [ ] Remove the extension, `/autofill-assist`, browser LiteRT model delivery, obsolete settings, and superseded documentation.
11. [ ] Complete security, performance, failure, real-browser, packaging, and documentation gates.

## Milestones and gates

### Gate 0 — plan approval

- [ ] User reviews this directory.
- [ ] User explicitly authorizes implementation.
- [ ] Move the entire directory from `pipeline/` to `in-progress/` before implementation begins.

### Gate 1 — feasibility

- [ ] .NET 10 API starts with PostgreSQL 18 and an isolated test database.
- [ ] Managed Chromium renders a real multi-page site and retains cookies/session state across navigation.
- [ ] A live viewport is visible within an ApplyFill development route with acceptable local latency.
- [ ] User control and agent control can transfer without simultaneous input or session replacement.
- [ ] Qwen3-VL 4B and 8B are benchmarked on the development RTX 2070 (8 GB, compute capability 7.5) with 32 GB system RAM; 8B is the preferred quality candidate even when it requires CPU/GPU split inference, while 2B remains a diagnostic fallback.
- [ ] PaddleOCR-VL parses representative single- and multi-column resumes on the same RTX 2070 through a CC 7.5-compatible backend.
- [ ] Prove Qwen and PaddleOCR can be loaded and unloaded sequentially without requiring both models to fit in VRAM simultaneously.
- [ ] Replace the selected Qwen test model with a second conforming model through configuration/manifest changes only, without editing workflow code or database schemas.

### Gate 2 — persistent multi-page vertical slice

- [ ] Start one application run from ApplyFill.
- [ ] Complete at least three distinct pages with a redirect or SPA transition.
- [ ] Persist a checkpoint after every material action and navigation.
- [ ] Pause, take control, edit a value manually, return control, and continue the same run.
- [ ] Recover the run after reloading ApplyFill and after restarting the browser worker.
- [ ] Reach final review without an extension and without per-page user reconnection.

### Gate 3 — data and privacy cutover

- [ ] PostgreSQL is the sole authoritative profile, resume, tracker, dashboard, and application-run store.
- [ ] Application-layer encryption protects approved high-sensitivity fields with keys outside PostgreSQL.
- [ ] Screenshots and transient page observations expire and are not included in backups by default.
- [ ] Existing development data is explicitly imported or deliberately reset; no indefinite legacy reader remains.
- [ ] Backup, restore, migration rollback, and deletion procedures are tested.

### Gate 4 — product completion

- [ ] Resume import, tailored resume selection, file upload, conditional questions, page validation, popup/tab changes, and final-review stopping work end to end.
- [ ] Login, MFA, CAPTCHA, missing-answer, unsupported-control, model-failure, browser-crash, and network-interruption handoffs are understandable and recoverable.
- [ ] The Browser Agent is fully usable with keyboard and screen reader controls in light and dark themes.
- [ ] A non-technical user can install ApplyFill, select **Set Up Private AI**, start an application, and use pause/stop/take-control without seeing or configuring any model/runtime/provider terminology.
- [ ] The extension and obsolete browser-only AI architecture are removed.

### Gate 5 — release acceptance

- [ ] All unit, integration, contract, migration, browser, model-conformance, security, accessibility, and packaging suites pass.
- [ ] A human completes representative applications in a release-like local installation without submitting unintended applications.
- [ ] Documentation and gallery screenshots show the shipped Browser Agent, control handoff, progress, and final review.
- [ ] Threat model, retention table, model/license inventory, and limitations are current.

## Completion rule

This plan suite is complete only when ApplyFill can start, navigate, pause, hand off, resume, recover, and finish a multi-page application inside its own main layout; PostgreSQL 18 is authoritative; local vision/document models are evaluated and pinned; the extension and obsolete compatibility paths are removed; and release evidence demonstrates privacy, safety, accessibility, and operational recovery. Record the outcome and remaining limitations here before moving the entire directory to `completed/`.
