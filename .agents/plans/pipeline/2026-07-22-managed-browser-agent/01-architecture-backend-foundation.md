# Workstream 01 — Architecture and Backend Foundation

**Status:** Pipeline  
**Depends on:** Plan approval  
**Unblocks:** Every other workstream

## Objective

Restore a clean ASP.NET Core 10 backend and define the stable contracts for persistence, browser streaming, agent orchestration, model inference, and UI updates. Reuse sound domain concepts from historical work only after re-evaluating them against the managed-browser product; do not restore obsolete controllers or compatibility code wholesale.

## Architecture decisions

- [ ] Write an architecture decision record choosing a local/private first release rather than a centrally hosted multi-user service.
- [ ] Decide how ApplyFill is launched locally: packaged desktop launcher, local ASP.NET-served web app, or another reviewed same-origin shell.
- [ ] Make the first release topology explicit: which processes run on the host, which run in containers, and which require GPU access.
- [ ] Decide whether managed Chromium runs in the API process, a dedicated .NET Worker, or an isolated browser-worker process; prefer isolation from API request threads.
- [ ] Define process crash and restart ownership for API, browser worker, model runners, and PostgreSQL.
- [ ] Define supported operating systems for the first release; do not claim cross-platform packaging without acceptance on each platform.
- [ ] Document the boundary between the Browser Agent product and ordinary profile/resume/tracker APIs.
- [ ] Explicitly retire the static-only Cloudflare architecture as a release target only after the local replacement is operational.

## Solution restoration

- [ ] Restore a root .NET solution targeting `net10.0` only.
- [ ] Restore or recreate `Api`, `Application`, `Domain`, `Infrastructure`, and `Worker` projects with one-way dependencies.
- [ ] Keep HTTP/SignalR DTOs separate from EF Core entities and domain aggregates.
- [ ] Add central package/version management if it reduces drift across projects.
- [ ] Pin ASP.NET Core, EF Core, Npgsql, Playwright, OpenAPI, validation, and test packages to reviewed .NET 10-compatible releases.
- [ ] Restore the local `dotnet-ef` tool at a reviewed 10.x version; ensure `.config/dotnet-tools.json` contains no .NET 9 tool.
- [ ] Add analyzers, nullable reference types, warnings-as-errors policy, deterministic builds, and consistent formatting.
- [ ] Remove stale `bin/net9.0` and `obj` artifacts from acceptance evidence; do not treat generated binaries as source.

## Service boundaries

- [ ] Define `IApplicationRunService` for starting, pausing, stopping, resuming, taking control, returning control, and recovering runs.
- [ ] Define `IBrowserSession` and `IBrowserSessionFactory` without leaking Playwright/CDP types into Application or Domain projects.
- [ ] Define `IVisionInferenceProvider` and `IDocumentParsingProvider` independently from Ollama, vLLM, llama.cpp, or Paddle implementations.
- [ ] Define provider-neutral model descriptors covering stable model ID, revision, modalities, approved tasks, runtime, quantization, context/image limits, structured-output support, tool support, hardware requirements, license, artifact integrity, and lifecycle state.
- [ ] Define a model registry/resolver that selects an installed model by required capability and user quality/performance preference rather than hardcoded model names.
- [ ] Keep workflow prompts and output schemas in versioned task definitions outside provider adapters; adapters translate task inputs to runtime-specific requests only.
- [ ] Require every provider/model combination to pass the same task conformance suite before it can become active.
- [ ] Define `IAgentPolicyEngine` for allowed actions, user gates, prohibited pages, sensitive fields, and final submission.
- [ ] Define `ICheckpointStore`, `IArtifactStore`, `ISensitiveValueProtector`, and authenticated/current-user abstractions.
- [ ] Define clock, identifier, and retry abstractions needed for deterministic state-machine tests.
- [ ] Prevent browser and model adapters from directly querying DbContext or arbitrary user-profile fields.

## API and real-time contracts

- [ ] Version the REST API and SignalR/browser-stream protocol independently.
- [ ] Define start-run requests using a job/application target and selected profile/resume IDs—not arbitrary executable instructions.
- [ ] Define run projections containing status, current stage, current URL/domain, progress, pending question, control owner, recoverability, and timestamps.
- [ ] Define commands for pause, resume, stop, take control, return control, answer question, approve upload, and approve final submission.
- [ ] Define idempotency keys and optimistic-concurrency tokens for every state-changing command.
- [ ] Define typed ProblemDetails codes for stale run, invalid transition, control conflict, browser unavailable, model unavailable, policy denial, and recovery failure.
- [ ] Define SignalR events for state changes, frame metadata, browser navigation, pending questions, progress summaries, and recoverable failures.
- [ ] Bound payload sizes and explicitly prohibit raw prompts/reasoning from normal client events.
- [ ] Generate or share TypeScript contracts rather than manually duplicating backend enums and envelopes.

## Local service security foundation

- [ ] Bind internal services to loopback or a private container network; do not expose PostgreSQL, model APIs, or browser debugging ports publicly.
- [ ] Establish a local installation identity/secret and same-origin session protection.
- [ ] Use HTTPS or a reviewed desktop-shell trust boundary; document local certificate provisioning if applicable.
- [ ] Configure exact CORS/origin policies; never use permissive credentialed CORS.
- [ ] Add request-size limits, rate limits for expensive browser/model commands, anti-forgery protection, and secure headers.
- [ ] Add health/readiness checks that reveal service state without exposing user content.

## Developer experience

- [ ] Provide one documented command to restore/build/test the .NET solution.
- [ ] Provide one documented local-stack command that starts PostgreSQL 18 and required inference services.
- [ ] Fail fast with plain explanations when Docker, PostgreSQL, Chromium, GPU support, or model artifacts are missing.
- [ ] Keep secrets and model licenses out of committed configuration.
- [ ] Add sample configuration containing safe placeholders only.

## Focused verification

- [ ] Build every project with .NET 10 SDK and zero errors.
- [ ] Prove no source project or tool targets .NET 9.
- [ ] Unit-test API command validation and illegal state-transition responses.
- [ ] Contract-test TypeScript and .NET serialization compatibility.
- [ ] Verify internal ports are unreachable from non-loopback interfaces in the default topology.
- [ ] Publish the stable interfaces and contract version to all dependent workstreams.

## Exit criteria

- [ ] Approved ADR and topology exist.
- [ ] API, Worker, and contract test hosts start without production model downloads.
- [ ] Deterministic fakes support browser, model, and persistence integration by other workstreams.
- [ ] No restored WeatherForecast/sample controller, obsolete AI proxy, or entity-shaped endpoint remains.
