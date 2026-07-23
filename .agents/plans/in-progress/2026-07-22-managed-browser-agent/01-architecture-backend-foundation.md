# Workstream 01 — Architecture and Backend Foundation

**Status:** Implemented — release acceptance pending
**Depends on:** Plan approval  
**Unblocks:** Every other workstream

## Objective

Restore a clean ASP.NET Core 10 backend and define the stable contracts for persistence, browser streaming, agent orchestration, model inference, and UI updates. Reuse sound domain concepts from historical work only after re-evaluating them against the managed-browser product; do not restore obsolete controllers or compatibility code wholesale.

## Outcome

The local/private .NET 10 foundation, PostgreSQL-backed APIs, isolated Browser Worker, versioned model/task contracts, SignalR stream, and one-command local launcher are implemented. Release acceptance remains pending because a few originally proposed interface names were superseded by concrete equivalents and the cross-language/protocol/security acceptance probes are incomplete.

## Evidence

- Accepted topology: `docs/adr/0001-local-managed-browser-topology.md`; one-command lifecycle: `scripts/local/start.ps1`, `status.ps1`, and `stop.ps1`.
- Current automated evidence: .NET 10 solution builds cleanly with zero warnings/errors, 26 API/persistence tests pass, 76 Browser Worker tests pass, and all five launcher helper tests pass.
- The current source/tool manifests and generated build trees contain no .NET 9 target or `net9.0` output.

## Remaining gates

- Generate the frontend contracts from the accepted backend schema instead of retaining the current deliberately matched TypeScript transport types.
- Complete the remaining cross-language serialization and illegal-transition acceptance probes before packaging.

## Architecture decisions

- [x] Write an architecture decision record choosing a local/private first release rather than a centrally hosted multi-user service.
- [x] Decide how ApplyFill is launched locally: packaged desktop launcher, local ASP.NET-served web app, or another reviewed same-origin shell.
- [x] Make the first release topology explicit: which processes run on the host, which run in containers, and which require GPU access.
- [x] Decide whether managed Chromium runs in the API process, a dedicated .NET Worker, or an isolated browser-worker process; prefer isolation from API request threads.
- [x] Define process crash and restart ownership for API, browser worker, model runners, and PostgreSQL.
- [x] Define supported operating systems for the first release; do not claim cross-platform packaging without acceptance on each platform.
- [x] Document the boundary between the Browser Agent product and ordinary profile/resume/tracker APIs.
- [x] Explicitly retire the static-only Cloudflare architecture as a release target only after the local replacement is operational.

## Solution restoration

- [x] Restore a root .NET solution targeting `net10.0` only.
- [x] Restore or recreate `Api`, `Application`, `Domain`, `Infrastructure`, and `Worker` projects with one-way dependencies.
- [x] Keep HTTP/SignalR DTOs separate from EF Core entities and domain aggregates.
- [x] Add central package/version management if it reduces drift across projects.
- [x] Pin ASP.NET Core, EF Core, Npgsql, Playwright, OpenAPI, validation, and test packages to reviewed .NET 10-compatible releases.
- [x] Restore the local `dotnet-ef` tool at a reviewed 10.x version; ensure `.config/dotnet-tools.json` contains no .NET 9 tool.
- [x] Add analyzers, nullable reference types, warnings-as-errors policy, deterministic builds, and consistent formatting.
- [x] Remove stale `bin/net9.0` and `obj` artifacts from acceptance evidence; do not treat generated binaries as source.

## Service boundaries

- [x] Define `IApplicationRunService` for starting, pausing, stopping, resuming, taking control, returning control, and recovering runs.
- [x] Define `IBrowserSession` and `IBrowserSessionFactory` without leaking Playwright/CDP types into Application or Domain projects.
- [x] Define `IVisionInferenceProvider` and `IDocumentParsingProvider` independently from Ollama, vLLM, llama.cpp, or Paddle implementations.
- [x] Define provider-neutral model descriptors covering stable model ID, revision, modalities, approved tasks, runtime, quantization, context/image limits, structured-output support, tool support, hardware requirements, license, artifact integrity, and lifecycle state.
- [x] Define a model registry/resolver that selects an installed model by required capability and user quality/performance preference rather than hardcoded model names.
- [x] Keep workflow prompts and output schemas in versioned task definitions outside provider adapters; adapters translate task inputs to runtime-specific requests only.
- [ ] Require every provider/model combination to pass the same task conformance suite before it can become active.
- [ ] Define `IAgentPolicyEngine` for allowed actions, user gates, prohibited pages, sensitive fields, and final submission.
- [x] Define `ICheckpointStore`, `IArtifactStore`, `ISensitiveValueProtector`, and authenticated/current-user abstractions.
- [ ] Define clock, identifier, and retry abstractions needed for deterministic state-machine tests.
- [x] Prevent browser and model adapters from directly querying DbContext or arbitrary user-profile fields.

## API and real-time contracts

- [ ] Version the REST API and SignalR/browser-stream protocol independently.
- [x] Define start-run requests using a job/application target and selected profile/resume IDs—not arbitrary executable instructions.
- [x] Define run projections containing status, current stage, current URL/domain, progress, pending question, control owner, recoverability, and timestamps.
- [x] Define commands for pause, resume, stop, take control, return control, answer question, approve upload, and approve final submission.
- [x] Define idempotency keys and optimistic-concurrency tokens for every state-changing command.
- [x] Define typed ProblemDetails codes for stale run, invalid transition, control conflict, browser unavailable, model unavailable, policy denial, and recovery failure.
- [x] Define SignalR events for state changes, frame metadata, browser navigation, pending questions, progress summaries, and recoverable failures.
- [x] Bound payload sizes and explicitly prohibit raw prompts/reasoning from normal client events.
- [ ] Generate or share TypeScript contracts rather than manually duplicating backend enums and envelopes.

## Local service security foundation

- [x] Bind internal services to loopback or a private container network; do not expose PostgreSQL, model APIs, or browser debugging ports publicly.
- [x] Establish a local installation identity/secret and same-origin session protection.
- [x] Use HTTPS or a reviewed desktop-shell trust boundary; document local certificate provisioning if applicable.
- [x] Configure exact CORS/origin policies; never use permissive credentialed CORS.
- [x] Add request-size limits, rate limits for expensive browser/model commands, anti-forgery protection, and secure headers.
- [x] Add health/readiness checks that reveal service state without exposing user content.

## Developer experience

- [x] Provide one documented command to restore/build/test the .NET solution.
- [x] Provide one documented local-stack command that starts PostgreSQL 18 and required inference services.
- [x] Fail fast with plain explanations when Docker, PostgreSQL, Chromium, GPU support, or model artifacts are missing.
- [x] Keep secrets and model licenses out of committed configuration.
- [x] Add sample configuration containing safe placeholders only.

## Focused verification

- [x] Build every project with .NET 10 SDK and zero errors.
- [x] Prove no source project or tool targets .NET 9.
- [x] Unit-test API command validation and illegal state-transition responses.
- [ ] Contract-test TypeScript and .NET serialization compatibility.
- [x] Verify internal ports are unreachable from non-loopback interfaces in the default topology.
- [ ] Publish the stable interfaces and contract version to all dependent workstreams.

## Exit criteria

- [x] Approved ADR and topology exist.
- [x] API, Worker, and contract test hosts start without production model downloads.
- [x] Deterministic fakes support browser, model, and persistence integration by other workstreams.
- [x] No restored WeatherForecast/sample controller, obsolete AI proxy, or entity-shaped endpoint remains.
