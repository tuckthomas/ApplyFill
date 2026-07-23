# Data retention and deletion

**Version:** 2026-07-22  
**Scope:** the supported local ApplyFill topology  
**Principle:** retain durable user records until the user deletes them; keep browser observations and AI working material in memory by default; never use logs as a data store

This table is the product retention contract. “Database backup” means PostgreSQL only. Local artifacts, browser profiles, and Data Protection keys require separate handling and must not be assumed to be present in a database backup.

## Profile and application-answer fields

| Field or record | Classification | Durable location | Retention and deletion | Database backup | Model boundary |
| --- | --- | --- | --- | --- | --- |
| First, middle, and last name; alternative names | Private | PostgreSQL profile | Until profile field/profile/delete-all removal | Yes | Excluded unless an approved task explicitly needs a non-restricted display name |
| Email addresses and phone number | Private | PostgreSQL profile | Until profile field/profile/delete-all removal | Yes | Excluded from writing and page-reasoning prompts; deterministic insertion only |
| Street address lines, city, region, postal code, country | Private | PostgreSQL profile | Until profile field/profile/delete-all removal | Yes | Excluded from models; deterministic insertion only |
| LinkedIn, GitHub, portfolio, and other web links | Private | PostgreSQL profile | Until removed from profile/delete-all | Yes | Excluded by default; deterministic insertion where the target is exact |
| Government identifier and international equivalent | Restricted | Separately protected application-only payload in PostgreSQL | Until the field/profile/delete-all is removed; pending plaintext approval is one-use | Encrypted payload only; matching keys required | Never |
| Work authorization and sponsorship answers | Restricted | Protected application-answer payload | Until changed/removed/profile/delete-all | Encrypted when stored in protected payload | Never as plaintext; deterministic mapping only after the configured approval boundary |
| Voluntary demographic, race/ethnicity, gender, veteran, and disability answers | Restricted | Protected application-answer payload when the user elects to save | Until changed/removed/profile/delete-all | Encrypted payload only | Never |
| Date of birth | Prohibited profile field | Not collected | No retention | No | Never |
| Citizenship or detailed immigration status | Prohibited unless a future separately reviewed workflow authorizes it | Not collected by the current profile | No retention | No | Never |
| Consent acknowledgement and privacy version | Private metadata | PostgreSQL profile/consent record | Until profile/delete-all; superseded versions may remain as audit metadata without form values | Yes | Never needed |

## Professional profile fields

| Field or record | Classification | Durable location | Retention and deletion | Database backup | Model boundary |
| --- | --- | --- | --- | --- | --- |
| Professional summary and narrative | Private professional data | PostgreSQL profile/resume | Until record or delete-all removal | Yes | Allowed only through a task-specific safe projection |
| Employer, job title, dates, current-job flag, location | Private professional data | PostgreSQL experience record | Until experience/profile/delete-all removal | Yes | Allowed when required by resume/application task |
| Experience duties, achievements, and narrative | Private professional data | PostgreSQL experience record | Until experience/profile/delete-all removal | Yes | Allowed through task-specific projection |
| Reason for leaving | Restricted employment data | PostgreSQL experience/application answer | Until experience/profile/delete-all removal | Yes, protected where classified as application-only | Excluded from resume-writing and general model prompts; user approval for application use |
| Employer street address and company phone | Private | PostgreSQL experience record | Until experience/profile/delete-all removal | Yes | Excluded from writing prompts; deterministic insertion only |
| Supervisor name and permission to contact | Restricted employment data | PostgreSQL experience record | Until experience/profile/delete-all removal | Yes | Excluded from writing prompts; application use requires exact mapping and user policy |
| School, degree, field of study, dates, GPA | Private professional data | PostgreSQL education record | Until education/profile/delete-all removal | Yes | Allowed when required by resume/application task |
| Skills, projects, certifications, awards, and portfolio content | Private professional data | PostgreSQL profile/resume | Until individual record/profile/delete-all removal | Yes | Allowed through task-specific projection |

## Resumes, jobs, artifacts, and UI data

| Field or record | Classification | Durable location | Retention and deletion | Database backup | Model boundary |
| --- | --- | --- | --- | --- | --- |
| Resume draft, selections, template, and tailoring metadata | Private | PostgreSQL | Until resume/delete-all removal | Yes | Safe projection only |
| Imported resume source file | Private file | Local owner-scoped artifact root; metadata/digest in PostgreSQL | Retain as the current profile source; replace after explicit overwrite confirmation; remove with profile/delete-all | Metadata only unless artifacts are backed up separately | OCR/document model receives only the selected document locally |
| Generated PDF, DOCX, cover letter, or application artifact | Private file | Local owner-scoped artifact root; metadata/digest in PostgreSQL | Until artifact/parent record/delete-all removal | Metadata only; files require separate backup | Content model only for the approved generation task |
| Job URL, company, role, description, notes, status, and dates | Private application history | PostgreSQL job tracker | Until job/delete-all removal | Yes | Minimum task-specific fields only |
| Dashboard widget content and layout | Private or preference | PostgreSQL for substantive content; local browser storage only for approved presentation preferences | Substantive content until deletion; presentation preference until browser-site data is cleared | PostgreSQL content only | Never needed |
| Theme, date format, sort order, and non-substantive layout preferences | Non-sensitive preference | Browser local storage | Until changed, site data is cleared, or delete-data operation includes preferences | No | Never |
| Exported JSON/PDF/DOCX downloaded by the user | Private file outside ApplyFill | User-selected filesystem location | User controls retention after download | No | Outside ApplyFill after export |

## Browser Agent and AI working data

| Field or record | Classification | Durable location | Retention and deletion | Database backup | Model boundary |
| --- | --- | --- | --- | --- | --- |
| Application run ID, owner, state, revision, and checkpoint sequence | Private metadata | PostgreSQL | Until run/delete-all removal | Yes | IDs and closed state codes only when necessary |
| Current application URL | Private browsing data | PostgreSQL run recovery state | Until run/delete-all removal; query strings/fragments must not enter ordinary summaries or logs | Yes | Minimize to origin/path when model context is required |
| User-visible action summary and verification result | Private metadata | PostgreSQL checkpoint | Until run/delete-all removal | Yes | Closed codes rather than raw values |
| Pending question text and user decision | Private | PostgreSQL run state | Until resolved and no longer required for recovery, then remove with run/delete-all | Yes while retained | Minimum question text only; restricted answer excluded |
| Pending sensitive approval metadata | Restricted metadata | PostgreSQL approval record containing the protected profile source path, target control, state, expiry, and concurrency binding—not a copied plaintext value | Expire automatically as an authorization; retain only as long as required for run audit/recovery, then remove with the run/profile/delete-all | Metadata only; the source value remains in the separately protected profile payload | Never |
| Raw sensitive approval plaintext | Restricted | Process memory only | Zero/release after the one authorized insertion attempt; never checkpoint or log | No | Never |
| Raw screenshot/frame | Private and untrusted | Process memory/short-lived stream only by default | Replace as newer frames arrive; release on disconnect, stop, failure, or cleanup; never ordinary backup | No | A bounded screenshot may be supplied to the local vision model |
| Raw DOM/accessibility snapshot and page values | Private and untrusted | Process memory only by default | Release after observation/action verification or run cleanup | No | Only bounded semantic observation; hidden/unrelated values excluded |
| Prompt and raw model response | Private and untrusted | Process memory only | Release after validation/cancellation/failure; never ordinary persistence or diagnostics | No | This is the model boundary itself; prohibited fields remain structurally absent |
| Hidden model reasoning/chain-of-thought | Prohibited persisted data | Not stored or displayed | No retention | No | Never requested as a persisted product output |
| Browser cookies, storage, history, and retained authentication context | Restricted credentials/browsing data | Dedicated local managed-Chromium profile | Retain only as needed for the retained run/session; remove on run/profile expiry, explicit browser-data deletion, or delete-all | No | Never |
| Temporary upload copy | Private file | Worker-controlled temporary directory | Delete immediately after successful transfer or on cancellation/failure/run cleanup | No | Never |
| Browser download | Private/untrusted file | Worker-controlled download directory only for an explicitly approved workflow | Deny by default; approved downloads are scanned/validated and removed on run cleanup unless explicitly saved as an artifact | No | Never requested arbitrarily by a model |
| Model/runtime files and manifests | Non-user data, integrity-critical | Local Private AI directory | Until model removal/update/uninstall; deletion does not delete profile data | No | Executable/model input to runtime, not user context |

## Secrets, backups, logs, and diagnostics

| Field or record | Classification | Durable location | Retention and deletion | Backup rule |
| --- | --- | --- | --- | --- |
| ASP.NET Core Data Protection keys | Restricted secret | Configured local key directory outside PostgreSQL | Until delete-data/uninstall-and-delete; rotate only through an approved migration | Excluded from database backup; back up separately with equivalent protection when recoverability is desired |
| Database credentials and worker/service tokens | Restricted secret | Ignored environment/installation secret storage | Until rotation, reset, or uninstall | Never include in source, logs, diagnostics, or ordinary data export |
| Operational logs | Content-free operational metadata | Local log sink | Bounded by packaged log rotation; delete with diagnostics/delete-data | Not part of the user-data backup |
| Error responses and ProblemDetails | Content-free transient diagnostic | Network response and optional content-free log | Request lifetime plus bounded operational logging | Must not contain secrets or private payload values |
| Database backup | Restricted private archive | User-selected secure backup location | User-managed; destroy obsolete copies securely | Requires matching Data Protection keys to read protected fields |
| Artifact backup | Restricted private archive | User-selected secure backup location | User-managed separately from PostgreSQL | Include only with explicit user intent; protect like original documents |

## Deletion behavior

- **Delete one record:** remove that record, dependent records owned solely by it, and its unshared local artifacts. Do not silently delete shared profile facts used elsewhere.
- **Delete one application run:** stop active control, invalidate streams/leases, remove checkpoints, pending questions/approvals, temporary files, observations, frames, and its managed-browser data when not shared by another retained run.
- **Delete profile:** remove the profile aggregate, protected application-only payload, retained source-resume artifact, and dependent saved answers according to the API's confirmed cascade. Independent exported files remain outside ApplyFill.
- **Delete all data:** stop active services safely, delete PostgreSQL user records, owner-scoped artifacts, browser profiles, temporary files, local preferences, and installation keys. Model files may be offered as a separate choice because they contain no profile data.
- **Uninstall application:** must be a distinct choice from deleting user data. An updater or repair must preserve data unless the user explicitly chooses deletion.
- **Expired or failed work:** cancellation, worker crash, model failure, and service shutdown must enter cleanup on the next startup if immediate cleanup could not finish.

Deletion is not complete until durable records, local artifacts, temporary data, and retained browser state in scope are removed. PostgreSQL backups, artifact backups, and files exported by the user are separate copies and require separate deletion.

## Backup and restore

1. Stop or quiesce writes before taking a consistent backup.
2. Back up PostgreSQL and, if protected-field recovery is required, the matching Data Protection key directory.
3. Back up the artifact root separately only when the user intends to retain generated/imported files.
4. Never include browser profiles, screenshots, prompts, model output, temporary uploads/downloads, service tokens, or connection strings in the default user-data backup.
5. Restore into an isolated local environment and verify ownership, migrations, protected-field readability, and artifact digests.
6. A database restored without its original keys is expected to leave protected fields unreadable; ApplyFill must not fabricate or silently discard them.

## Verification obligations

- Seed recognizable secrets and prove they do not appear in logs, traces, error bodies, checkpoints, diagnostics, screenshots saved by tests, or model requests.
- Exercise per-record, per-run, profile, browser-data, and delete-all workflows and inspect PostgreSQL plus every local storage root afterward.
- Test expiry cleanup after normal completion, stop, cancellation, worker crash, API restart, browser crash, and model failure.
- Perform a backup/restore drill with matching keys and a negative restore test without them.
- Verify local browser preferences are limited to the approved non-authoritative list.
- Record retention exceptions and unresolved cleanup defects in release evidence; do not convert an intended rule into an implied test success.
