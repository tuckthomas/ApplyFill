# Client-Side Resume Generation

> **ARCHIVED AND SUPERSEDED — 2026-07-22:** This completed plan records the former IndexedDB/browser-only resume architecture. ApplyFill now stores resume records authoritatively in PostgreSQL through the .NET 10 API and uses backend provider boundaries for document/AI workflows. See [current architecture](../../../docs/architecture.md) and [data retention](../../../docs/data-retention.md). The checklist remains historical evidence, not current implementation guidance.

**Approved:** 2026-07-18  
**Status:** Complete — 2026-07-18

> **Historical architecture note from 2026-07-18:** At completion, ApplyFill shipped as a static application with no backend. The historical server-suite verification item below records that transition point; verification at that time was pnpm-only and included local AI, static deployment, and the Chromium extension.

## Outcome

Implement the resume builder as a local-first document workflow. Resume drafts are versioned documents in IndexedDB. PDF, DOCX, and JSON exports are generated in the browser from an explicit resume-safe view model and are never uploaded to ApplyFill.

PDF and DOCX are sibling exports. ApplyFill does not convert Word documents to PDF or PDFs to Word.

## Privacy boundary

- [x] Define an allowlisted export-safe view model containing only public contact information and selected resume content.
- [x] Exclude government identifiers, work authorization, sponsorship, voluntary demographic answers, reasons for leaving, supervisor details, supervisor-contact permission, street addresses, company phone numbers, and internal editing metadata.
- [x] Ensure PDF, DOCX, and preview consume the allowlisted model; portable resume JSON contains draft configuration only and no profile data.
- [x] Keep generated files ephemeral unless the user explicitly downloads them.
- [x] Keep the .NET API out of resume persistence and document generation.

## Local resume documents

- [x] Add `applyfill.resume-collection` schema version 1.
- [x] Store local resume drafts through the shared IndexedDB boundary.
- [x] Track title, target role/URL, summary, content selections, template, timestamps, and source-profile update time.
- [x] Validate imported resume JSON before adding local data.
- [x] Add local resume copy, JSON download, and JSON import controls.
- [x] Delete drafts locally without a backend call.

## Builder workflow

- [x] Replace the placeholder Resume Builder with a functional local editor.
- [x] Load the local profile and initialize a draft from saved resume-safe content.
- [x] Support selecting individual experience, project, education, and skill entries.
- [x] Support a resume-specific professional summary without modifying the source profile.
- [x] Save drafts in IndexedDB and make existing drafts reopenable.
- [x] Provide accessible loading, empty-profile, validation, save, and export states.
- [x] Make desktop, intermediate, and mobile layouts responsive and theme-token driven; verify the live desktop layout in light and dark themes.

## PDF export

- [x] Add a client-side React PDF document template.
- [x] Use the same PDF component for live preview and PDF download.
- [x] Generate a PDF Blob locally and download it without an API request.
- [x] Show page count and warn when a resume exceeds two pages.
- [x] Keep browser printing out of the canonical PDF path; it may be added later as a secondary action.

## DOCX export

- [x] Generate an editable DOCX from the same export-safe view model.
- [x] Create the DOCX Blob in the browser and download it locally.
- [x] Keep DOCX a compatibility export; do not promise pixel parity with PDF.

## Verification

- [x] Add unit coverage for schema parsing, IndexedDB storage, validated JSON import, export allowlisting, and sensitive-field exclusion.
- [x] Add renderer coverage for non-empty PDF and DOCX output.
- [x] Run frontend lint, tests, production build, dependency audit, and the .NET test suite.
- [x] Browser-test draft creation, persistence, reopening, preview, PDF download, DOCX download, and JSON download; validate JSON import through the parser/storage tests because the browser harness cannot attach files to the native picker.
- [x] Browser-test the live desktop layout in light and dark themes; verify intermediate/mobile behavior through the implemented CSS breakpoints.
- [x] Refresh the README Resume Builder gallery screenshot.

## Documentation

- [x] Replace the stale Playwright-for-.NET/Razor export checklist.
- [x] Update the local-first architecture decision with resume-document and generated-file boundaries.
- [x] Update `.agents/README.md`, design documentation, task status, root README, and frontend README.
- [x] Document installed client document-generation dependencies and the no-conversion rule.

## Implementation outcome

ApplyFill now stores versioned resume drafts in IndexedDB, projects the complete profile through an explicit resume-safe allowlist, previews and downloads PDF with React PDF, creates a separate browser-side DOCX compatibility export, and supports validated portable resume JSON. Generated binaries are not persisted or uploaded. Automated tests cover storage, schema rejection, sensitive-field exclusion, and non-empty PDF/DOCX output.

## Completion rule

When every applicable item is verified, mark the checklist complete, record the implementation outcome, and move this file to `.agents/plans/completed/`.
