# ApplyFill Agent Documentation

This directory contains repository guidance intended for AI coding agents and future maintainers.

Before making frontend or UI changes, agents must read `design/DESIGN.md`, inspect the reusable components it references, and verify the result in the running application. The design document must be updated whenever the shared component inventory, route behavior, or global interaction rules change.

ApplyFill is a static Vite/React PWA. Its implemented routes are `/`, `/job-profile`, `/job-profile/builder`, `/job-tracker`, `/resumes`, `/resumes/builder`, and `/settings`; legacy route redirects remain navigation conveniences only. Profiles, resume drafts, job applications, and dashboard documents are stored in IndexedDB through `frontend/src/features/storage/localDatabase.ts`. There is no ApplyFill account database, persistence API, application backend, cloud AI fallback, or server-side secret.

Do not describe IndexedDB as a cache: it is the authoritative local datastore. Model chunks use their own versioned, integrity-verified Cache Storage boundary and must never be mixed into the document database. Do not introduce a second profile persistence path, a silent import fallback, server synchronization, authentication, telemetry, cloud storage, or remote AI provider without an approved plan that explicitly revisits the privacy model. Theme, sorting, regional, and extension-ID preferences may remain in `localStorage` because they are lightweight UI preferences rather than substantive user records.

Application-only data includes repeatable country-specific work authorization/sponsorship answers and optional government identifiers. Do not place those fields in generated resumes or send them through AI writing endpoints. Identifier values must remain masked in normal profile summaries; exact values may appear only in an intentional edit control or the explicitly labeled structured-data export view. ApplyFill does not collect date of birth, citizenship, or specific immigration status.

Resume preview and export have a stricter boundary: `frontend/src/features/resume/resumeExport.ts` is an explicit allowlist. PDF, DOCX, resume JSON, preview, and resume-specific AI must consume that model, never the complete profile. Do not add government identifiers, application questions, work authorization, sponsorship, reasons for leaving, supervisor data, company phone numbers, street addresses, or internal editing metadata. PDF and DOCX are generated independently in the browser and must not be routed through a server or converted from one another.

Local AI is governed by `frontend/src/features/local-ai/`: same-origin verified model assets, explicit user download, automatic compatibility selection, strict AI-safe projections, untrusted-text quoting, a constrained non-executable response envelope, closed output validation, and review before mutation. Compatibility must be checked before downloading, ordinary users must not choose accelerators, and progress must use plain-language percentages rather than raw byte counts. Schema/version/patch bookkeeping is client-owned; bullet source ownership must come from one exact unique match against the approved snapshot. The selected LiteRT-LM.js LLM uses WebGPU. WebNN/NPU detection is experimental, developer-facing, and must not be presented as an active LLM backend. Local inference does not imply IndexedDB encryption.

Resume import is governed by `frontend/src/features/profile/resumeImport.ts` and `frontend/src/features/local-ai/workflows/profileImport.ts`. Source PDF/DOCX/TXT files are ephemeral and must never be written to IndexedDB, Cache Storage, logs, diagnostics, or telemetry. Contact suggestions are deterministic. Names, email, phone, links, street-address-like lines, and identifier patterns are removed before bounded professional text reaches the model. Model output is a proposal only; exact schemas, explicit review, existing-value preservation, duplicate suppression, and safe rich-text conversion are mandatory.

The `extension/` package is a separate least-privilege Manifest V3 surface. It persists an origin-and-secret-bound derived profile copy in extension-local storage so users pair once and remain ready across applications and browser restarts. ApplyFill refreshes that copy after profile saves, and explicit unpair deletes it. Page inspection and review sessions remain active-tab scoped and ephemeral. Deterministic mapping runs first; only ambiguous non-sensitive descriptors may open the same-origin `/autofill-assist` bridge, and only when the explicitly downloaded model is already cached. The extension must never persist page values/DOM/reports, handle credentials, upload files, accept legal attestations, or submit an application. Sensitive values are opt-in, bypass AI, remain masked, and require per-field confirmation.

## Structure

- `design/` - product design system, visual language, accessibility, and interaction rules.
- `planning/` - forward-looking product architecture, implementation direction, and technical decisions. It is not a claim that planned features already exist.
- `tasks/` - implementation-status checklist. Update it when an item is completed, deferred, or superseded.
- `plans/pipeline/` - proposed implementation plans awaiting explicit review and approval. Do not implement these plans.
- `plans/in-progress/` - approved plans currently being executed. Move a plan here only after explicit instruction to begin it.
- `plans/completed/` - completed, superseded, or cancelled plans, updated with their final outcome before the move.

A large plan may be a directory containing a coordinating `README.md` and independently assignable checklist files. Move the entire plan directory through the lifecycle as one unit. The coordinating file must state dependencies, shared-file ownership, integration order, and completion gates so parallel agents do not create conflicting contracts or claim partial work as complete.

Plans progress in one direction: `pipeline/` → `in-progress/` → `completed/`. A request to review a plan is not approval to start it. Preserve this distinction even when adjacent frontend work is already implemented.

The root `README.md` remains the public project overview and current gallery. The frontend README stays beside the frontend package so its commands and routes remain discoverable in context. The repository `LICENSE` controls the current source-available usage terms; planning notes do not change them.

When a visible application area changes materially, refresh the matching README screenshot from the running frontend and update its caption in the root README. Store gallery assets under `frontend/public/readme/gallery/`; do not present mockups as product screenshots.

Historical plans may describe the retired PostgreSQL architecture. They must carry a visible superseded notice and must not be used as current implementation guidance.

## Pipeline proposal

`plans/pipeline/2026-07-22-managed-browser-agent/` proposes replacing the current static-only, extension-assisted architecture with a local ASP.NET Core 10/PostgreSQL 18 application and a managed, streamed Chromium browser inside the ApplyFill main layout. It is a proposal only: the current IndexedDB, LiteRT-LM.js, extension, and Cloudflare-static implementation remain authoritative until the suite is reviewed, explicitly approved, and moved intact to `plans/in-progress/`.
