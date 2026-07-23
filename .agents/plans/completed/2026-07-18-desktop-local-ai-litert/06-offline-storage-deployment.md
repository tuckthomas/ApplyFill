# Workstream F — Model Storage, Static Deployment, and Backend Retirement

> **ARCHIVED AND SUPERSEDED — 2026-07-22:** Static-only deployment, IndexedDB authority, browser model caching, and backend retirement were later reversed. PostgreSQL 18 is now authoritative, the .NET 10 backend is required, and native local services own Private AI and managed-browser automation. See [current architecture](../../../../docs/architecture.md) and [data retention](../../../../docs/data-retention.md).

**Status:** In progress  
**Depends on:** Runtime asset requirements from Workstream A, selected model manifest from Workstream C, and extension build requirements from Workstream E  
**Final retirement gate depends on:** Product and verification acceptance

## Objective

Make local AI installable and reusable without turning large model files into substantive user documents. Deliver ApplyFill as static assets while preserving strict origin, integrity, offline, and recovery behavior.

## Storage design

- [x] Keep profile, resume, tracker, and dashboard documents in the existing IndexedDB database and storage boundary.
- [x] Store model binaries in Cache Storage or OPFS based on measured browser support and streaming needs; do not store multi-gigabyte blobs in the existing document store by default.
- [x] Store only model manifest/version, user preference, download state, and non-sensitive diagnostics metadata in a small versioned local settings document.
- [x] Request persistent browser storage only after explaining its purpose and limitations.
- [x] Report quota and estimated model size before download.
- [x] Keep model removal separate from profile/resume deletion.
- [x] Ensure clearing ApplyFill data can deliberately remove both substantive documents and model assets when the user selects that scope.
- [x] Recover cleanly from eviction, partial downloads, corrupt cache entries, and manifest rollback attempts.

## Model delivery and integrity

- [x] Self-host approved runtime and model artifacts from ApplyFill-controlled static origins.
- [x] Use content-addressed/versioned asset paths and immutable caching where appropriate.
- [x] Verify artifact digest before compilation and after completed download.
- [x] Reject an artifact when its digest, expected size, runtime compatibility, or manifest schema does not match.
- [x] Preserve the last known-good model until a replacement has been fully verified.
- [x] Document model license and attribution beside the distributed artifacts.
- [x] Do not use service-worker update behavior that deletes a working model prematurely.

## Offline behavior

- [x] Decide whether ApplyFill becomes an installable PWA or remains an offline-capable static site; document the choice.
- [x] Cache the application shell, required WASM/runtime files, and selected model deliberately.
- [x] Verify reload and generation with the network disabled after initial installation.
- [x] Make offline readiness visible and distinguish app-ready from model-ready.
- [x] Avoid caching user-generated downloads or exposing private records through HTTP caches.
- [x] Version service-worker/cache migrations and provide a recovery path for a broken deployment.

## Security and platform headers

- [x] Define the minimum Content Security Policy for self-hosted scripts, workers, WASM, model fetches, and object/blob previews.
- [x] Add COOP/COEP/CORP headers only as required for WASM threading or isolation and test impact on PDF/DOCX previews and downloads.
- [x] Prevent model/runtime assets from broad cross-origin reuse unless explicitly required.
- [x] Verify no Vite environment variable exposes secrets.
- [x] Verify production network activity is limited to static asset/model acquisition and explicit user navigation.

## Cloudflare deployment

- [x] Choose Cloudflare Pages/static assets or a Worker static-assets deployment based on header, range-request, and artifact-size requirements.
- [x] Verify maximum individual artifact size, total deployment size, bandwidth/caching behavior, and range-request support against the selected model.
- [x] Configure long-lived immutable caching for hashed model/runtime artifacts and short-lived/no-cache behavior for manifests.
- [x] Keep sensitive user data out of Worker requests, logs, analytics, and error reporting.
- [x] Add a deployment smoke test for headers, WASM loading, model range/download, integrity, and SPA routing.
- [x] Host the extension separately through the browser's extension distribution/developer-install path; do not represent a Cloudflare-hosted page as having extension permissions.

## .NET backend retirement gate

- [x] Inventory every remaining frontend request, controller, package, container, test, document, and environment variable associated with the .NET API.
- [x] Classify each responsibility as replaced by local AI, still required, or already unused.
- [x] Demonstrate local parity for every approved AI workflow before deletion.
- [x] Obtain explicit approval for backend removal if the accepted scope changes materially during implementation.
- [x] Remove `src/`, `tests/`, the solution, Docker/backend configuration, API environment variables, and packages only when the inventory reaches zero required responsibilities.
- [x] Remove backend prerequisites, badges/tags, commands, architecture diagrams, and agent guidance in the same change.
- [x] Verify no documentation claims .NET is part of the shipped product after removal.
- [x] If any backend remains, document its exact stateless purpose and why static-only delivery is not yet complete.

## Focused tests

- [x] Test quota denial, eviction, corruption, interrupted download, update, rollback, and model removal.
- [x] Test offline application startup and offline inference.
- [x] Test CSP/COOP/COEP headers in deployment-like preview.
- [x] Test that model management does not alter profile/resume documents.
- [x] Test production bundles and network traces for API endpoints and secrets.

## Handoff

- [x] Provide final deployment commands, limits, headers, and backend status to Workstream G.
- [x] Provide screenshots/status states for README gallery capture after integration.
