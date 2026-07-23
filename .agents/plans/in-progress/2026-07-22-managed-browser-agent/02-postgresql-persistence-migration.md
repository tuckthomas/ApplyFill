# Workstream 02 — PostgreSQL 18 Persistence and Data Cutover

**Status:** Implemented — release acceptance pending
**Depends on:** Workstream 01 contract skeleton  
**Unblocks:** Persistent runs, recovery, server-backed profile/resume/tracker UI, extension retirement

## Objective

Make PostgreSQL 18 the single authoritative store for ApplyFill records and multi-page browser-agent state. Preserve the privacy boundary through local deployment, application-layer encryption, explicit retention, and removal of indefinite IndexedDB fallbacks.

## Outcome

PostgreSQL 18.4 is the authoritative release-like store for profiles, resumes/artifacts, tracker records, runs, browser sessions, approvals, audit records, and model evaluations. The former substantive IndexedDB path and dual writes are gone. Release acceptance remains pending on exhaustive ownership, encryption/key-lifecycle, retention, rollback, and populated backup/restore proof.

## Evidence

- The official PostgreSQL 18.4 image is digest-pinned in `compose.yaml`; all six EF Core migrations apply to the healthy local database, and PostgreSQL 18 Testcontainers cover clean creation.
- The current backend suite has 26 passing tests covering clean migration, resource ownership/pagination, settings JSONB/ETag concurrency, profile concurrency/idempotency, sensitive-field structure and masking, encryption wrong-key failure, and sensitive approval approve/deny/missing paths.
- `docs/data-retention.md` and `docs/threat-model.md` define the current classification, encryption, ephemeral-frame, backup, and local trust-boundary policies; backup/restore/reset scripts exist.
- No supported pre-current database-backup baseline exists, so the conditional representative-prior-backup upgrade check is not applicable; the retained migration chain is exercised instead.

## Remaining gates

- Complete normalization/history bounds, transaction rollback, diagnostic-redaction, key lifecycle/deletion/backup behavior, and time-controlled retention coverage.
- Add a migration rollback command and complete a populated backup/restore drill containing a paused run, profile, resume, and tracker record. The optional legacy-import checklist remains inactive unless an import cutover is explicitly approved.

## PostgreSQL foundation

- [x] Pin the latest reviewed official PostgreSQL 18 image/build and record the exact version.
- [x] Configure a named local volume, health check, UTF-8 locale, timezone policy, and least-privilege application/test roles.
- [x] Bind PostgreSQL only to the private service network or loopback.
- [x] Use Npgsql/EF Core 10 with retry behavior limited to safe/idempotent operations.
- [x] Add migrations to source control and test both clean creation and upgrade from the last retained schema baseline.
- [x] Add Testcontainers coverage against PostgreSQL 18, not an in-memory EF substitute.
- [ ] Define backup, restore, migration rollback, and development reset commands before records become authoritative.

## Aggregate model

- [x] Define account/installation ownership appropriate to the approved local topology.
- [x] Restore a canonical `Profile` aggregate with personal, contact, address, education, experience, projects, skills, application answers, consent, and version information.
- [x] Keep government identifiers and high-sensitivity application answers in a separately protected structure.
- [x] Define `Resume` and immutable/generated `ResumeArtifact` records without exposing application-only fields to renderers.
- [x] Define `JobApplication` records for tracker/dashboard state independently from a live agent run.
- [x] Define `ApplicationRun` as the persistent workflow root with target, status, browser-session reference, current stage, control owner, retry count, and concurrency token.
- [x] Define ordered `RunCheckpoint`, `AgentAction`, `ActionResult`, `PendingQuestion`, and `UserDecision` records.
- [x] Define `BrowserSession` metadata without persisting raw cookie values in ordinary relational columns.
- [x] Define `Artifact` metadata for selected/generated resumes and cover letters; store binaries through the approved artifact boundary rather than large arbitrary JSONB fields.
- [x] Define `ModelEvaluation` and model-manifest metadata without storing private prompts or production observations.
- [ ] Persist stable task/model selection preferences and evaluation metadata without coupling domain records or migrations to a specific vendor/model name.
- [x] Store the model ID, revision, provider, task-definition version, and output-schema version used for an action/checkpoint so future models remain auditable without changing the action schema.

## Data-shape and validation rules

- [x] Use explicit columns for identity, ownership, status, ordering, timestamps, and queryable lifecycle fields.
- [x] Use JSONB only for versioned bounded structures that genuinely vary, with server-side schema validation before persistence.
- [x] Preserve restricted Tiptap JSON and continue rejecting raw HTML.
- [ ] Bound every collection, string, JSON depth, artifact size, and checkpoint/action history.
- [ ] Normalize phone numbers, dates, URLs, country/state identifiers, GPA pairs, and enums consistently with frontend behavior.
- [x] Use stable GUID/UUID identifiers; never persist UI-only numeric IDs or React editing flags.
- [x] Use optimistic concurrency for profile, resume, job application, and run commands.
- [x] Make every query ownership-scoped and prove it in integration tests.

## Sensitive data protection

- [x] Classify fields as ordinary personal, application-sensitive, credential/session, ephemeral observation, or security secret.
- [x] Encrypt approved high-sensitivity values in the application layer using keys stored outside PostgreSQL.
- [ ] Define key creation, local storage, rotation, backup implications, and unrecoverable-key messaging.
- [x] Never include encryption keys, browser-profile secrets, cookies, MFA values, raw screenshots, or credentials in database backups.
- [x] Mask sensitive values in API responses unless a named user action requires the exact value.
- [ ] Add redaction tests for logs, ProblemDetails, traces, and diagnostics.

## Browser and agent retention

- [x] Persist semantic action summaries and results needed for recovery; do not persist chain-of-thought.
- [x] Keep current URL/domain, page-stage classification, field completion state, and validation failures in checkpoints.
- [x] Store raw screenshots and DOM/accessibility snapshots ephemerally outside normal tables, with explicit expiration and deletion.
- [x] Decide whether a crash-recovery frame is retained; if retained, encrypt it and enforce a short TTL.
- [ ] Compact or archive action history after completion while preserving user-visible audit facts.
- [ ] Delete browser session state and transient observations when the user deletes/stops a run according to the approved retention policy.

## IndexedDB cutover

- [x] Inventory every authoritative IndexedDB store, schema version, and consuming UI path.
- [x] Choose a development cutover policy: explicit one-time import or intentional reset with export instructions.
- [ ] If import is approved, validate the complete document before server mutation and show a preflight summary.
- [ ] Make import idempotent, owner-scoped, transactionally safe, and conflict-aware.
- [ ] Verify the server copy before deleting or disabling local authoritative records.
- [x] Remove the import implementation after the supported development cutover window; do not preserve a permanent legacy reader.
- [x] Remove all dual writes and prove PostgreSQL is the only authoritative source.
- [x] Retain lightweight local UI preferences only if explicitly approved and non-authoritative.

## API persistence coverage

- [x] Implement profile read/update with aggregate validation and concurrency.
- [x] Implement resume create/read/update/delete and artifact metadata.
- [x] Implement job-application tracker queries and mutations.
- [x] Implement application-run queries, checkpoints, transitions, questions, decisions, and recovery claims.
- [x] Add pagination/filtering for histories and completed runs.
- [x] Ensure API DTOs never expose EF navigation cycles, provider metadata, encrypted blobs, or internal browser secrets.

## Verification

- [x] Apply migrations to an empty PostgreSQL 18 database.
- [x] Upgrade a representative prior database backup where a supported baseline exists.
- [ ] Test transaction rollback for partial profile, resume, and run writes.
- [x] Test owner isolation across every aggregate and child-resource route.
- [x] Test concurrency conflicts and idempotent command replay.
- [ ] Test encryption round-trip, wrong-key failure, masking, deletion, backup, and restore behavior.
- [ ] Test retention jobs with time-controlled fixtures.
- [ ] Complete a backup/restore drill and verify a paused run, profile, resume, and tracker record.

## Exit criteria

- [x] PostgreSQL 18 is authoritative in a release-like local stack.
- [x] IndexedDB is no longer a writable source of substantive records.
- [x] Recovery-critical state survives API and browser-worker restart.
- [ ] Sensitive and ephemeral data follow the approved classification and retention table.
