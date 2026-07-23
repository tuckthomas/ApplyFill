# Workstream 09 — Verification, Deployment, and Documentation

**Status:** Implemented — release acceptance pending
**Depends on:** Harness starts after approval; final acceptance depends on all workstreams  
**Unblocks:** Completion and release

## Objective

Provide reproducible evidence that the restored backend, PostgreSQL 18, managed browser, vision models, multi-page agent, control handoff, and migration work together safely in a release-like local installation. Package the system so ordinary users can install, start, update, recover, and remove it without understanding the service topology.

## Test strategy

- [x] Create a matrix separating deterministic CI tests, model-conformance tests, hardware/browser tests, packaging tests, and real-site manual acceptance.
- [x] Keep deterministic fake browser/model adapters so core state, policy, and UI tests do not require GPU models.
- [x] Run real PostgreSQL 18 integration tests through Testcontainers.
- [x] Run real managed-Chromium tests against synthetic ATS fixtures.
- [x] Pin test fixtures and expected contracts; do not depend on mutable public job sites in CI.
- [x] Record untested hardware/sites explicitly rather than generalizing from one machine.

## Synthetic ATS fixture application

- [x] Build a local test site with at least ten application steps and persistent server-side test state.
- [x] Cover ordinary inputs, textareas, native/custom selects, comboboxes, radio groups, checkboxes, dates, rich text, uploads, and repeated entries.
- [x] Cover full navigation, redirects, SPA transitions, iframe controls, Shadow DOM, popup/new-tab flow, and back navigation.
- [x] Cover conditional branching, dynamically required fields, duplicated questions, validation errors, disabled continuation, and final review.
- [x] Add explicit login, MFA, CAPTCHA-simulation, sensitive disclosure, legal attestation, and final submission gates.
- [x] Add hostile prompt-injection, hidden field, honeypot, unrelated navigation, download, and exfiltration fixtures.
- [x] Add deterministic confirmation and uncertain-submission scenarios.

## Automated suites

- [x] Domain unit tests for aggregates, state transitions, control lease, policy, retries, compaction, and recovery.
- [x] Application tests for mapping, validation, prompt construction, schema parsing, action verification, and handoffs.
- [x] API contract tests for auth, ownership, idempotency, concurrency, ProblemDetails, pagination, and payload limits.
- [ ] Database integration tests for migrations, rollback, encryption, retention, backup/restore, and owner isolation.
- [x] Browser-worker tests for lifecycle, navigation, frames, input relay, handles, uploads, crashes, and cleanup.
- [ ] Frontend component/browser tests for every run state, accessibility, responsive layout, and user/agent handoff.
- [ ] Cross-service end-to-end tests for start → multi-page completion → final review → tracker update.
- [x] Security tests from Workstream 07, including prompt injection and content-exfiltration attempts.
- [ ] Dependency, container, secret, license, and static-analysis scans.

## Real-model acceptance

- [ ] Run the pinned Qwen model against the page fixture holdout set and record field/action metrics.
- [ ] Run the pinned PaddleOCR model against the resume fixture holdout set and record entity/layout metrics.
- [ ] Exercise malformed output, cancellation, timeout, GPU out-of-memory, runtime crash, and restart.
- [ ] Swap the active vision model to another conforming revision/provider, rerun the same application corpus, and roll back without workflow-code or database-schema changes.
- [x] Verify model services receive no prohibited sensitive context.
- [ ] Record startup, observation, action-planning, and document-processing latency plus peak memory.
- [ ] Verify model downloads/updates/removal and checksum failures through the packaged UI.

## Multi-page acceptance scenarios

- [ ] Complete a three-page smoke application with no user intervention until final review.
- [ ] Complete the ten-page fixture with conditional branches and an uploaded tailored resume.
- [ ] Pause during model planning, take control, edit a field, return control, and finish.
- [ ] Reload ApplyFill while the browser continues and reattach to the same run.
- [ ] Restart the browser worker and recover from the latest verified checkpoint.
- [ ] Restart the API and verify persisted run/profile/resume/tracker state.
- [ ] Handle login/MFA/CAPTCHA simulation without losing session or objective.
- [x] Prove final submission never happens without the configured approval and never retries uncertain submission.
- [ ] Stop and later resume a retained run; delete another run and verify transient cleanup.

## Performance and reliability budgets

- [ ] Define acceptable local startup, browser-start, first-frame, control-handoff, ordinary-action, checkpoint, and recovery latency.
- [ ] Define maximum idle/active CPU, GPU memory, system memory, disk, and frame bandwidth on tested hardware.
- [ ] Define maximum concurrent runs for the first release.
- [ ] Run sustained multi-page and repeated-run leak tests.
- [ ] Verify cleanup after completion, stop, deletion, model failure, browser crash, and service shutdown.
- [ ] Test low-disk, PostgreSQL unavailable, model unavailable, browser unavailable, port conflict, certificate failure, and corrupted-artifact behavior.

## Packaging and installation

- [x] Choose the supported local installer/launcher after Workstream 01's topology decision.
- [ ] Package or provision .NET 10 runtime, frontend assets, managed Chromium, PostgreSQL 18, model runtime, and required native libraries according to license.
- [x] Do not bundle multi-gigabyte model weights without explicit licensing and installer-size approval; support verified post-install acquisition.
- [x] Provide one Start/Stop/Status experience rather than asking ordinary users to manage containers individually.
- [ ] Hide internal process topology completely in the ordinary installer and application; users must not separately configure PostgreSQL, Chromium, model runtimes, ports, APIs, or container networks.
- [x] Detect missing GPU/runtime capabilities and select only evaluated fallbacks.
- [ ] Make updates transactional with rollback to the last-known-good application/database/model/browser versions.
- [x] Verify future model installation and activation are independent from application deployment when contracts remain compatible.
- [ ] Preserve user data during application updates and clearly separate delete-app from delete-data.
- [ ] Test install, upgrade, repair, backup, restore, uninstall-with-data, and uninstall-and-delete-data.

## Development and CI

- [x] Provide documented `dotnet`, `pnpm`, database, browser, model, and full-stack commands.
- [x] Use pnpm rather than npm for frontend work.
- [x] Cache only safe build dependencies in CI; do not cache private test data or production browser profiles.
- [x] Keep real-model/hardware suites opt-in or on dedicated runners while deterministic gates remain mandatory.
- [x] Publish concise **SUCCESS**, **FAILURE**, and **WARNING** summaries consistent with repository conventions.

## Documentation

- [x] Update root README with the current architecture, local privacy boundary, software versions, prerequisites, setup, development, verification, limitations, and recovery.
- [x] Update frontend/backend/worker documentation and API/OpenAPI discovery.
- [x] Update `.agents/README.md`, `.agents/design/DESIGN.md`, planning notes, task status, and plan outcome.
- [x] Document model choices, licenses, revisions, checksums, tested hardware, metrics, and unsupported configurations.
- [x] Document PostgreSQL backup/restore, encryption-key handling, retention, deletion, and troubleshooting.
- [x] Document Browser Agent controls, user handoffs, credential/MFA/CAPTCHA handling, final review, and emergency stop in ordinary language.
- [x] Document that no extension is required or supported.

## Gallery and visual acceptance

- [ ] Capture real product screenshots—not mockups—of Browser Agent idle/start, agent running, multi-page progress, user control, pending question, resume upload, final review, failure/recovery, and completion.
- [ ] Capture representative light and dark themes at readable desktop sizes.
- [x] Store gallery assets under `frontend/public/readme/gallery/` and remove superseded extension/local-AI screenshots.
- [x] Update README gallery captions and alt text.
- [x] Verify gallery does not expose real credentials, government identifiers, private resumes, cookies, or application data.

## Ordinary-user usability gate

- [ ] Give a non-technical tester only the installer and the goal “set up ApplyFill and begin a job application”; do not provide terminal commands or model/runtime documentation.
- [ ] Verify the tester completes setup through one **Set Up Private AI** action without asking which model, provider, accelerator, runtime, port, container, or quantization to choose.
- [ ] Verify all visible setup, update, failure, pause, stop, take-control, and recovery language is understandable without developer explanation.
- [ ] Treat any requirement to open a terminal, Docker Desktop, Ollama, LM Studio, Python, or a model-server interface as a product failure.

## Release evidence

- [x] Create `artifacts/release-verification.md` with exact commands, versions, test counts, migration results, model metrics, browser acceptance, packaging results, and limitations.
- [x] Create `artifacts/model-evaluation.md`, `artifacts/runtime-evaluation.md`, and `artifacts/security-review.md` during execution.
- [x] Record every manual gate and do not label it automated.
- [x] Record failures and unresolved limitations instead of converting them into implied success.

## Exit criteria

- [ ] A clean machine can install/start ApplyFill and reach the Browser Agent without manual service surgery.
- [x] The complete implemented automated matrix passes.
- [ ] Release-like multi-page and control-handoff acceptance passes with pinned local models.
- [x] Documentation and screenshots match the shipped development architecture.
- [ ] The parent plan can truthfully be marked complete and moved to `completed/`.

## Outcome and evidence

**Outcome:** Implemented — release acceptance pending.

- `artifacts/test-matrix.md` and `artifacts/release-verification.md` record a successful .NET Release build, 122 .NET tests, 47 frontend tests across 15 files, frontend lint/build, five launcher tests, formatting, clean NuGet/pnpm dependency audits, six PostgreSQL 18 migrations, a full local start/status drill, and a real two-column PDF vision import on the RTX 2070.
- `.github/workflows/ci.yml` runs deterministic .NET/PostgreSQL/Chromium/policy and frontend lint/test/build/audit gates with no cache of private data or browser profiles.
- The 13-step synthetic ATS and current documentation, security, cutover, runtime, and model artifacts provide reproducible development-build evidence.

Remaining gates are held-out Qwen/Paddle metrics, real-model failure and model-swap acceptance, integrated multi-page Browser Agent scenarios, performance/resource/soak budgets, comprehensive cleanup/degraded-environment tests, a packaged clean-machine installer/updater/rollback/uninstall drill, complete accessibility and gallery-state capture, non-technical-user testing, and manual security and real-site acceptance. The repository remains a verified development build rather than a production installer.
