# Backend Persistence and API Readiness

> **SUPERSEDED — updated 2026-07-18:** ApplyFill adopted a static, local-first architecture. The database, application backend, persistence/authentication layers, and remote AI provider were removed. Records now use browser IndexedDB, and approved AI workflows run locally through LiteRT-LM.js. The material below is retained only as historical implementation evidence and is not an active plan.

**Status:** Superseded and archived by the local-first privacy architecture  
**Created:** 2026-07-16  
**Scope:** Bring the backend to feature parity with the existing profile, resume, job-tracker, and dashboard forms without allowing the frontend to outrun a stable API contract.

## Decision requested

Approve the phased backend-persistence program described below. Approval authorizes moving this file from `pipeline/` to `in-progress/`; it does **not** authorize a blanket implementation of every phase. Each phase has its own completion gate and should be reviewed before the next phase begins. Checkboxes are the execution record and must only be marked complete with evidence.

## Baseline assessment at plan creation

The API has a sound starting point—.NET 10, PostgreSQL/EF Core 10, migrations, a development user, OpenAPI, an AI boundary, and a consent endpoint—but it is not the persistence backend for the product forms yet.

When this plan was created, the profile builder, job tracker, dashboard widgets/layouts, and preferences saved in browser `localStorage`. The only form-adjacent API interactions were profile-consent capture and AI text enhancement. Resource controllers, request/response contracts, application services, ownership checks, concurrency rules, and integration tests had not yet been implemented. The execution evidence at the end of this document records the current state.

The database model is also not yet a direct representation of today’s frontend forms. Creating thin CRUD controllers now would either discard fields or establish a contract that immediately needs breaking changes. The correct first move is contract/schema alignment, followed by aggregate APIs and a deliberately staged client migration.

## Baseline inventory at plan creation

| Area | Frontend behavior today | Backend status | Readiness |
| --- | --- | --- | --- |
| Personal profile | Browser-local profile, address, alternative names, and web links | `UserProfile`, `Address`, and `WebLink` exist; no profile read/write API | Partial schema, no API |
| Profile application questions | Browser-local race/ethnicity, veteran, and disability answers | No matching persistence model or API | Missing |
| Education, experience, projects, skills | Browser-local repeatable form data | Resume child entities exist; no aggregate service/API and not connected to a persisted resume | Partial schema, no API |
| Rich text | Restricted Tiptap JSON stored locally | No server-side contract validation or persistence policy | Missing boundary |
| Job tracker | Browser-local application records including status, date, notes, structured location, and job description | `JobTarget` and `ApplicationLog` exist, but fields and workflow do not match the UI; no API | Significant alignment needed |
| Dashboard | Browser-local widget instances, layout, and text-widget content | No dashboard preference/entity/API | Missing |
| Settings | Browser-local date format/theme/navigation preferences | No preference model or API | Missing |
| Consent | API-backed record and lookup | `ProfileConsentsController` exists | Implemented baseline |
| AI enhancement | Backend call from form fields | `AiController` and service exist | Implemented baseline |

## Material contract and schema gaps

### Profile aggregate

`UserProfile` supports first/last name, email, phone, address, web links, work authorization, sponsorship, and desired compensation. The current UI additionally captures a middle name, repeatable alternative names with contexts, and application-question answers. The database has no first-class representation for alternative names or application-question answers, and the existing profile fields for work authorization/sponsorship/compensation are not currently presented by the profile form.

**Required decision:** Treat the profile builder as the canonical user-profile aggregate and migrate the schema to it, rather than silently dropping UI fields or exposing entity-shaped endpoints.

### Resume aggregate

The database models a resume plus education, experience, projects, skills, documents, and layout analysis. The UI is currently a reusable source-profile builder—not a persisted, selectable resume—so it has no resume ID or server identity. It also contains data that does not map one-to-one: experience reason-for-leaving, rich-text JSON, skill proficiency, and current UI identifiers/editing flags are not all represented as durable server fields.

**Required decision:** Establish whether the builder saves a canonical profile that can seed resumes, or whether it creates/edits a default resume directly. The recommended approach is a canonical profile aggregate first, then explicit resume creation from it; that avoids conflating application-only private data with resume content.

### Job tracker

The UI’s `JobApplication` has company, title, workplace type, structured location, posting URL, structured job description, status, applied date, and notes. The closest backend concepts split this across `JobTarget` and `ApplicationLog`, while `ApplicationPacket` additionally requires a resume and job target. `JobTarget` does not contain workplace type, structured location, description, notes, applied date, or the UI’s status lifecycle. `ApplicationLog` has status, submission time, and notes but is not an application-record aggregate.

**Required decision:** Add a dedicated `JobApplication` aggregate/entity (recommended), instead of forcing the UI into an indirect `JobTarget` plus `ApplicationLog` composition. `JobTarget` can remain a reusable lead/target later if that product distinction is valuable.

### Dashboard and preferences

No entity maps widget definitions, responsive layouts, text-widget JSON, date-format preference, theme, or navigation state. These are appropriate to keep browser-local during the first persistence phase unless cross-device sync is a committed requirement. They should not block profile and job-tracker persistence.

## Recommended API shape

The API should use task-oriented aggregate endpoints and DTOs, never EF entities as HTTP contracts. All endpoints derive the user from the authenticated principal; clients never submit `UserId`.

| Resource | Initial endpoints | Notes |
| --- | --- | --- |
| Profile | `GET /api/profile`, `PUT /api/profile` | One transactional aggregate: profile details, address, alternative names, web links, application questions, and revision token. Keep consent separate. |
| Resumes | `GET /api/resumes`, `POST /api/resumes`, `GET /api/resumes/{id}`, `PUT /api/resumes/{id}`, `DELETE /api/resumes/{id}` | Aggregate writes include ordered child collections. Ownership checks apply to every route. |
| Job applications | `GET /api/job-applications`, `POST /api/job-applications`, `GET /api/job-applications/{id}`, `PUT /api/job-applications/{id}`, `DELETE /api/job-applications/{id}` | Dedicated aggregate matching the current tracker; pagination/filtering can follow once records are server-backed. |
| Preferences (deferred) | `GET /api/preferences`, `PUT /api/preferences` | Only when cross-device syncing is approved. |
| Dashboard (deferred) | `GET /api/dashboard`, `PUT /api/dashboard` | Persist only a validated allow-listed widget/layout document; never arbitrary client JSON. |

Request DTOs must validate field length, required values, URLs, enum values, date precision, collection sizes, and the restricted rich-text JSON schema. Responses should return server-generated GUIDs, UTC timestamps, and an optimistic-concurrency revision (for example, a PostgreSQL `xmin` mapping or explicit version column).

## Execution checklist

### Approval and sequencing

- [x] Review the profile-versus-resume ownership decision.
- [x] Review the dedicated `JobApplication` aggregate recommendation.
- [x] Approve Phase 0 only.
- [x] Move this document from `pipeline/` to `in-progress/` after explicit instruction to begin.
- [x] Do not start Phase 1 until Phase 0 exit criteria are met and reviewed.
- [ ] Do not start Phase 2 until Phase 1 exit criteria are met and reviewed.
- [ ] Do not start Phase 3 until the canonical profile/resume decision is implemented and reviewed.
- [ ] Keep Phase 4 deferred unless cross-device preference/dashboard sync is explicitly approved.

### Phase 0 — Contract and persistence foundation

**Goal:** Make backend contracts safe to build against before touching form persistence.

- [x] Define API DTOs in the Application layer or a dedicated contracts project, with explicit mapping.
- [x] Decide and document canonical profile versus default-resume ownership.
- [x] Add database entities and migrations for alternative names and application-question answers.
- [x] Define the server-side restricted rich-text JSON validation policy.
- [x] Add a dedicated job-application aggregate and migration; do not force the tracker into `JobTarget` and `ApplicationLog`.
- [x] Reconcile UI-only fields with domain entities; remove or deliberately defer unsupported fields only with product approval.
- [x] Add an authenticated-user abstraction so controllers do not parse claims ad hoc.
- [x] Standardize `ProblemDetails`, validation, logging, and exception handling.
- [x] Define optimistic concurrency and collection replacement/merge rules.
- [x] Add API integration-test infrastructure using an isolated PostgreSQL test database or Testcontainers.

**Exit criteria:** Versioned contracts reviewed; migrations apply to an empty database; ownership, validation, and concurrency behavior are tested; no controller exposes an EF entity.

- [x] Contract review completed.
- [x] Migrations apply to an empty PostgreSQL database.
- [x] Ownership, validation, and concurrency behavior have integration-test coverage.
- [x] Confirm no controller exposes EF entities.
- [x] Review Phase 0 outcome before authorizing Phase 1.

### Phase 1 — Profile aggregate persistence

**Goal:** Persist the entire profile builder safely as one server-backed aggregate.

- [x] Implement profile query and transactional update service/controller.
- [x] Persist address, alternative names, web links, application questions, and approved profile fields.
- [x] Validate and store only restricted rich-text JSON where the approved schema contains rich text.
- [x] Keep consent recording separate; add consent status to a profile-read projection only if the UI needs it.
- [x] Add frontend API client and loading/error/retry states. No local-profile import was approved, so legacy local-profile persistence and migration code were removed.

**Exit criteria:** A user can reload the application or use another browser and recover the same profile; invalid or conflicting writes are handled without data loss; integration tests cover owner isolation and aggregate updates.

- [x] Verify profile reload in a fresh browser session.
- [x] Verify the same profile is available from a second browser session.
- [x] Verify invalid and conflicting writes preserve existing data.
- [x] Verify owner isolation and aggregate updates with integration tests.
- [ ] Review Phase 1 outcome before authorizing Phase 2.

### Phase 2 — Job-application tracker persistence

**Goal:** Replace browser-local application tracking with a first-class server aggregate.

- [ ] Add `JobApplication` entity, enum/status mapping, migration, DTOs, service, and controller.
- [ ] Preserve structured location, posting URL validation, Tiptap JSON fields, applied date, notes, and status-history rules.
- [ ] Add collection/list queries, filter/sort requirements, and deletion behavior.
- [ ] Migrate the frontend tracker incrementally behind the API client; do not retain two writable sources indefinitely.
- [ ] Offer a one-time local-storage import only after its conflict behavior is designed and tested.

**Exit criteria:** Tracker reads/writes use the API, records are owner-isolated, and dashboard pipeline data derives from the same API-backed source.

- [ ] Verify tracker reads and writes use the API exclusively.
- [ ] Verify records are owner-isolated.
- [ ] Verify dashboard pipeline data uses the API-backed tracker source.
- [ ] Review Phase 2 outcome before authorizing Phase 3.

### Phase 3 — Resume aggregate persistence

**Goal:** Create explicit resumés from the canonical profile and persist resume-specific edits.

- [ ] Implement resume creation, list, detail, update, and deletion workflows.
- [ ] Map ordered experience, education, project, and skill collections with durable GUID identifiers; never persist UI-only numeric IDs or edit-state flags.
- [ ] Clarify separation of resume-safe data from application-only data such as demographic answers and reasons for leaving.
- [ ] Add resume document/layout endpoints only when their worker workflow is defined.

**Exit criteria:** A resume can be created from profile data, edited independently, and retrieved with stable ordering and concurrency protection.

- [ ] Verify a resume can be created from profile data.
- [ ] Verify independent resume edits retain stable ordering.
- [ ] Verify concurrency protection with integration tests.
- [ ] Review Phase 3 outcome before authorizing Phase 4.

### Phase 4 — Optional synced preferences and dashboard

**Goal:** Sync user experience configuration only if cross-device sync is a product requirement.

- [ ] Add a constrained preferences document for date format/theme/navigation.
- [ ] Add a validated dashboard document that allow-lists widget types and layout shape.
- [ ] Include document versioning and a migration strategy before adding new widget formats.

**Exit criteria:** Preferences and dashboards survive device changes without accepting arbitrary client payloads.

- [ ] Verify preferences and dashboard configuration survive a device change.
- [ ] Verify invalid widget types and arbitrary document payloads are rejected.

## Work estimate and sequencing

| Phase | Backend effort | Frontend integration | Main risk |
| --- | --- | --- | --- |
| 0: contracts/foundation | Medium–large | None | Resolving product/schema decisions before code hardens them |
| 1: profile | Large | Medium | Aggregate mapping, legacy browser data, private-question handling |
| 2: job tracker | Medium–large | Medium | Correctly separating job applications from job targets/logs |
| 3: resumes | Large | Large | Profile-to-resume ownership and ordered nested collections |
| 4: preferences/dashboard | Medium | Medium | Versioned JSON documents and layout validation |

The critical path is Phase 0 → Phase 1 → Phase 2. Resume persistence should not begin until the canonical profile decision is made. Dashboard and preference sync are intentionally non-critical and should not delay data-safety work.

## Security and operational checklist

- [ ] Replace development-only identity with real authentication before production exposure.
- [x] Verify every implemented resource query filters by the authenticated user.
- [x] Keep the Gemini key and all provider calls server-side.
- [x] Validate profile request payloads at the API boundary, including nested collections and rich-text JSON allow-lists.
- [x] Do not render or migrate raw HTML; retain the structured-document-only policy.
- [ ] Add request-size limits and rate limiting for AI endpoints before external deployment.
- [ ] Add correlation IDs, structured logs, and health checks before external deployment.
- [ ] Use HTTPS and an explicit CORS allow-list outside local development.
- [x] Back up PostgreSQL and test restore/migration procedures before user data becomes authoritative.

## Verification checklist

- [x] Add unit tests for mappings, validation, state transitions, and rich-text schema validation.
- [x] Add integration tests for authorization/ownership isolation and profile aggregate updates.
- [x] Add integration tests for profile validation failures, concurrency conflicts, and transaction rollback.
- [x] Test migrations against a clean PostgreSQL instance.
- [ ] Add frontend integration tests for save/load and offline/error behavior.
- [ ] Test one-time local-data import only where it is approved.
- [ ] Add end-to-end coverage of profile save/reload and job-application create/edit/delete.

## Explicitly out of scope for the first approved implementation

- Application submission automation, browser automation, and external ATS integrations.
- Worker-hosted document generation, PDF rendering, or asynchronous packet workflows.
- Cross-device dashboard and preference syncing.
- A broad browser-local-data migration without a reviewed import/conflict policy.
- Replacing the current development authentication mechanism with a specific identity provider before that provider is selected.

## Pipeline operation

- [x] Keep this plan in `pipeline/` while it is under review.
- [x] On explicit approval and instruction to execute, move this file to `in-progress/` and begin only Phase 0.
- [ ] Record completed, superseded, or cancelled work by moving its plan to `completed/` and adding the final outcome to the document.
- [ ] Do not move a plan out of `pipeline/`, or begin its implementation, based on inference from related frontend work.

## Phase 0 implementation evidence

- `dotnet build ResumeBuilder.sln --no-restore`: succeeded with 0 warnings and 0 errors.
- `dotnet test ResumeBuilder.sln --no-restore`: 26 passed, 0 failed, including real PostgreSQL 18.4 Testcontainers coverage.
- `dotnet ef migrations has-pending-model-changes`: no model changes remain outside the migration.
- Clean-database migration, API startup, owner-scoped consent, optimistic concurrency, restricted rich-text validation, JSONB persistence, and contract/entity-boundary tests pass.
- Phase 1 profile query/update services, API controller, restricted-rich-text validation, aggregate reconciliation, optimistic concurrency, and owner isolation are implemented.
- The React profile builder and review page now load and save through the profile API with loading, error, conflict, and retry states. No unapproved legacy local-profile import code remains.
- A browser acceptance run saved a profile to an isolated PostgreSQL 18.4 database, reloaded it, and recovered it in a second fresh tab. The temporary database was removed afterward.
- The local development database was logically backed up, restored from PostgreSQL 16.14 into PostgreSQL 18.4, migrated, and verified. The old container and volume remain available for rollback.
- `dotnet build ResumeBuilder.sln --no-restore` succeeds with 0 warnings and 0 errors; `pnpm build` and `pnpm lint` also succeed.
- Phase 2 has not started. Phase 1 is awaiting review before further pipeline work.
