# Local-First Data Architecture

**Adopted:** 2026-07-17  
**Status:** Current architecture decision

## Decision

ApplyFill does not operate a profile, account, resume, job-tracker, or dashboard database and has no application backend. Substantive user records are authoritative in the user's current browser and are stored in IndexedDB. AI-assisted editing runs locally through LiteRT-LM.js; no profile, prompt, or output is sent to ApplyFill or a cloud model provider.

## Storage boundaries

| Data | Storage | Portability |
|---|---|---|
| Source profile and local privacy acknowledgment | IndexedDB `profile` document | Versioned JSON copy, download, and validated import |
| Job applications | IndexedDB `job-applications` document | Future full-workspace backup plan |
| Dashboard widgets and layouts | IndexedDB `dashboard` document | Reconstructable; future full-workspace backup plan |
| Resume drafts | IndexedDB `resumes` document | Versioned individual JSON copy, download, and validated import |
| Generated PDF and DOCX | Ephemeral browser `Blob` | Explicit user download only; not persisted or uploaded |
| Theme, date format, and entry sorting | `localStorage` | Lightweight preferences, intentionally excluded from profile export |
| Local model chunks | Versioned Cache Storage | Explicit download; size and SHA-256 verified; removable independently |
| Local AI diagnostics | Memory and lightweight preference metadata | Content-free export only; no prompt/profile/output text |
| Extension session | Extension service-worker memory | Nonce/tab/origin/expiry bound; destroyed on disconnect/navigation/completion |

`frontend/src/features/storage/localDatabase.ts` is the sole substantive browser-storage boundary. IndexedDB is the datastore, not a cache.

## Portable profile contract

Profile documents use `format: "applyfill.profile"` and an explicit numeric `schemaVersion`. Imports are rejected unless the format, version, and required structure are recognized. Schema evolution must be explicit: add a new version and a reviewed migration or reject the unsupported document. Do not add silent legacy parsing.

The exported document includes the exact profile data stored locally, completion state, and update timestamp. Schema version 2 adds country-specific government identifiers, work-authorization and present-or-future sponsorship answers, and optional decimal GPA/grading-scale pairs on education records. Identifiers are masked in ordinary summaries but remain exact in IndexedDB and the structured export. Exported JSON contains sensitive personal data and is not encrypted.

Applicant and company phone numbers are canonicalized before entering the document: `+` followed by exactly 11 digits. Human-readable punctuation is a presentation concern and partial phone input is not persisted.

## Consent and privacy communication

Before profile fields unlock, the user acknowledges that:

- profile, tracker, and dashboard data remain in the current browser;
- clearing browser/site data can permanently erase it;
- ApplyFill cannot recover local data;
- users should download backups;
- local browser data is not encrypted by ApplyFill and anyone with device/browser-profile access may be able to read it;
- copied or downloaded structured data may contain exact government identifiers and must be protected;
- local AI actions create an allowlisted professional snapshot and keep inference inside the browser;
- local inference does not encrypt IndexedDB or protect an unlocked browser profile.

Application-only identifiers, work authorization, sponsorship, voluntary demographic answers, reasons for leaving, supervisor data, company phone numbers, street addresses, and editing metadata are excluded from resumes by an explicit allowlisted view model. Government identifiers are also excluded from AI writing requests. The profile intentionally does not collect date of birth, citizenship, or specific immigration status.

Resume drafts use `applyfill.resume-collection` schema version 1 in IndexedDB. Portable individual drafts use `applyfill.resume` schema version 1. React PDF generates the canonical preview and PDF Blob in the browser; `docx` generates an independent compatibility export from the same safe model. ApplyFill does not convert Word to PDF or PDF to Word.

The acknowledgment is part of the local profile. ApplyFill does not collect an IP address, browser fingerprint, authenticated identity, or remote audit record for it.

## Operational consequences

- PostgreSQL, EF Core, Npgsql, migrations, development auth, and persistence controllers are outside the architecture and must not be reintroduced incidentally.
- The complete application must function as static assets without an application API.
- A hostname or port change creates a different browser origin and therefore a different IndexedDB dataset.
- Clearing local data must require explicit confirmation and identify the records affected.
- Future synchronization requires a separate approved privacy design. A conventional server-readable database is not an assumed next phase.
- Model caches must stay separate from substantive documents, commit only verified artifacts, support offline reuse, and tolerate eviction/corruption without affecting user records.
- Browser extension access must remain user-started, active-tab scoped, short lived, review based, and incapable of final submission.

## Next planning work

- Design a full-workspace backup containing profile, resume, tracker, and dashboard documents.
- Evaluate optional passphrase-encrypted exports using Web Crypto.
- Define versioned local application-packet documents.
- Define zero-knowledge synchronization only if multi-device demand justifies its complexity.
