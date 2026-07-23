# Workstream 08 — Extension Retirement and Frontend Integration

**Status:** Implemented — release acceptance pending
**Depends on:** Replacement vertical slice from Workstreams 01–06 and security approval  
**Unblocks:** Clean release architecture

## Objective

Cut ApplyFill from browser-authoritative storage, browser LiteRT inference, and the Chromium extension to the new PostgreSQL-backed managed Browser Agent. Remove obsolete code completely after replacement verification; do not retain hidden fallbacks or two competing automation products.

## Cutover inventory

- [x] Inventory every file, route, setting, package, test, document, screenshot, and data flow associated with `extension/`.
- [x] Inventory `/autofill-assist`, extension pairing/handoff contracts, extension profile projections, session/pairing stores, permissions, and popup harnesses.
- [x] Inventory LiteRT-LM.js runtime, model manifest/chunks, Cache Storage, WebGPU capability UI, local model diagnostics, and browser AI workflows.
- [x] Inventory IndexedDB profile, resume, tracker, dashboard, and consent repositories and every direct consumer.
- [x] Classify which frontend validation, rich-text, profile, resume, and deterministic mapping logic should move/shared versus be deleted.
- [x] Create a deletion matrix with replacement proof required for each subsystem.

## Frontend API integration

- [ ] Add generated/shared typed clients for profile, resume, job application, application run, artifact, and settings APIs.
- [ ] Add authenticated SignalR client handling reconnect, backoff, resubscription, sequence gaps, and stale-event rejection.
- [x] Make backend projections authoritative; React state remains an editable/view cache only.
- [ ] Add loading, optimistic-concurrency conflict, offline/service-unavailable, retry, and recovery states.
- [x] Avoid indefinite dual writes between IndexedDB and PostgreSQL.
- [x] Keep restricted rich-text validation and resume-safe export boundaries on both client and server.

## Browser Agent integration

- [x] Wire the Browser Agent route to persistent run APIs and real-time stream/control events.
- [x] Start a run from a job tracker record, job URL, or reviewed dashboard action.
- [x] Link completed/paused/stopped runs back to one job-application record without duplication.
- [ ] Make selected resume/cover-letter artifacts server-addressable for managed-browser upload.
- [x] Remove user-facing references to pairing, connection codes, active-tab inspection, popup review, extension storage, and extension installation.

## Browser AI retirement

- [x] Replace browser LiteRT-LM resume import with the backend vision/document pipeline.
- [x] Replace browser resume-tailoring and ambiguous-field workflows with backend provider interfaces and the same strict product validators.
- [x] Preserve explicit model setup/download consent in the local backend UI.
- [x] Remove WebGPU/WebNN/NPU user and developer paths that no longer reflect the supported runtime.
- [x] Remove model chunks, WASM copying, Cache Storage management, service-worker model rules, and related CSP exceptions after replacement proof.
- [x] Update third-party notices and dependency manifests in the same change.

## Extension deletion

- [x] Remove the `extension/` package and all root/workspace references after managed-browser acceptance passes.
- [x] Remove extension settings panels, IDs, pairing secrets, handoff stores, `/autofill-assist`, and extension-only profile projections.
- [x] Remove extension installation, security, and protocol documentation or archive it with a clear superseded notice only when historical evidence is required.
- [x] Remove extension gallery screenshots and captions.
- [x] Remove CI jobs, package scripts, dependencies, and fixtures that exist only for the extension.
- [x] Search the repository for `extension`, `pair`, `connection code`, `active tab`, `autofill-assist`, and obsolete protocol identifiers; disposition every remaining reference.

## IndexedDB retirement

- [x] Execute the approved explicit import/reset cutover from Workstream 02.
- [ ] Replace storage calls with API-backed repositories throughout profile, resumes, tracker, dashboard, consent, and settings.
- [x] Remove authoritative IndexedDB schemas, migrations, repositories, service-worker assumptions, and tests after server-backed equivalents pass.
- [x] Retain only approved non-authoritative local UI preferences.
- [x] Update privacy/consent language before collecting or moving data into PostgreSQL.

## Documentation and product-language cutover

- [x] Update root README architecture, software table, privacy statement, routes, development commands, deployment, limitations, and gallery.
- [x] Update frontend README, `.agents/README.md`, `.agents/design/DESIGN.md`, planning notes, task checklist, and third-party notices.
- [x] Mark the completed static/LiteRT/extension plans as superseded by this shipped architecture without rewriting their historical evidence.
- [x] Remove claims that ApplyFill has no backend/database or that IndexedDB is authoritative.
- [x] Explain accurately that the first release stores data in the user's local PostgreSQL installation and runs models/browser locally.
- [x] Explain browser-session, screenshot, prompt, artifact, and action-history retention in ordinary language.

## Verification

- [x] Build/test the frontend with no extension package present.
- [ ] Prove every substantive UI record reloads from PostgreSQL.
- [ ] Prove Browser Agent observation, navigation, uploads, and control require no extension.
- [x] Prove production assets contain no LiteRT browser model, WebGPU runtime, extension bridge, or obsolete API route.
- [x] Run repository-wide stale-reference and dependency searches.
- [ ] Verify a clean install does not request extension installation or multi-gigabyte browser model download.

## Exit criteria

- [x] One supported architecture remains: ApplyFill UI + .NET backend + PostgreSQL 18 + managed Chromium + local native model services.
- [x] No hidden extension, IndexedDB authority, browser LiteRT, or static-only compatibility path remains.
- [x] Current documentation describes exactly the shipped architecture.

## Outcome and evidence

**Outcome:** Implemented — release acceptance pending.

- `artifacts/cutover-inventory.md` records each retired subsystem, its replacement, and deletion disposition.
- The verified frontend build and 28-test suite run without an extension package, browser LiteRT runtime, model cache, service worker, or authoritative IndexedDB repository.
- Current product and agentic documentation describe PostgreSQL 18, the .NET 10 backend, managed Chromium, native local Private AI, and no supported extension; historical plans carry explicit archival notices.

SignalR sequence-gap and stale-event rejection, automatic re-watch/REST recovery, API-backed artifact upload, PostgreSQL-backed dashboard/date settings, and ordinary offline/retry states are implemented and tested. Remaining gates are a generated client contract surface, server-addressable cover-letter upload, an integrated proof that every substantive UI record reloads from PostgreSQL, no-extension navigation/upload acceptance, and a clean-install check.
