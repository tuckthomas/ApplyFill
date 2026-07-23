# ApplyFill architecture

## Supported topology

ApplyFill is one local product made of cooperating processes:

1. The React frontend renders the workspace and Browser Agent controls.
2. The ASP.NET Core API owns user records, validation, concurrency, retention, and artifact metadata.
3. PostgreSQL 18 is the authoritative datastore.
4. The .NET Browser Worker owns managed Playwright Chromium sessions, frame capture, input relay, and run orchestration.
5. Native Private AI services provide vision, OCR, planning, and constrained writing responses through stable application contracts.

These process boundaries are developer and packaging details. The ordinary product must present one Start/Stop/Status experience and one **Set Up Private AI** action.

## Data flow

The frontend reads and writes versioned API resources. It may optimistically render edits, but a backend response and concurrency token decide what is durable. Browser Agent state is persisted as an application run and streamed to the UI through SignalR. Binary artifacts are stored under an owner-scoped local artifact root; metadata and integrity digests are stored in PostgreSQL.

The Browser Worker observes the current page, produces a bounded semantic snapshot and screenshot, asks the application planner for the next allowed action, executes it, verifies the result, and checkpoints before continuing. Page navigation does not create a new objective or require reconnection.

## Browser stream and control

ApplyFill displays sanitized JPEG frames from the managed browser and forwards bounded pointer, wheel, and keyboard events only while the user owns the control lease. Agent and user input are mutually exclusive. Run updates carry revisions so stale commands and stale stream events can be rejected.

## Replaceable Private AI

Product workflows depend on capabilities and validated schemas, not on a vendor command line or model filename. Manifests in `private-ai/catalog/` describe runtime compatibility, model revision, modality, memory profile, checksums, and approved task contracts. The resolver may select an evaluated quality model, smaller fallback, or CPU path without changing the workflow or database schema.

Prompts, safety policy, preprocessing, response schemas, and validators are versioned separately from model files. A new model is eligible only after it passes the same fixture corpus and contract checks. Activation and rollback are catalog/configuration changes; ordinary users never see provider or runtime names.

## API and worker boundaries

- Public resources use `/api/v1/`.
- Development OpenAPI is `/openapi/v1.json`.
- Browser Agent UI commands use `/api/browser-agent/` during the worker vertical slice and stream through `/hubs/browser-agent`.
- Worker-only session endpoints require loopback access and service/session credentials.
- CORS is an explicit local-origin allowlist. Commands are rate limited and responses use `ProblemDetails`.

The Browser Agent façade should ultimately be hosted behind the main API so packaged clients use one trusted origin. Internal worker topology must not become a user setting.

## Persistence and recovery

PostgreSQL records carry installation ownership and optimistic concurrency tokens. Application-run checkpoints record enough state to reattach after a UI reload and to recover after a worker restart without repeating an uncertain final submission. Final submission is a distinct user-approved transition and is never retried when its outcome is uncertain.

Database backups must include the matching Data Protection key directory. Sensitive application-only profile data cannot be restored without both.
