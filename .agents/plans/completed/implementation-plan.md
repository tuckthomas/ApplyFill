# Resume Builder & Agent-Ready Application Web App

> **ARCHIVED AND SUPERSEDED — 2026-07-22:** This document spans more than one abandoned architecture and is not current implementation guidance. ApplyFill now uses the React UI, .NET 10 API, PostgreSQL 18, a managed-Chromium Browser Agent, and native local Private AI services. See [current architecture](../../../docs/architecture.md), [threat model](../../../docs/threat-model.md), and [data retention](../../../docs/data-retention.md).

> **Historical supersession note from 2026-07-18:** At that transition point, this plan was superseded by a static local-first architecture in which substantive records lived in browser IndexedDB, portable documents used versioned JSON, PDF/DOCX were generated from a resume-safe client allowlist, approved AI ran through LiteRT-LM.js, and no application backend shipped. That replacement architecture has itself now been superseded.

> **Planning status:** This document describes historical intended architecture and future phases. It is not an implementation inventory. For current behavior and boundaries, use the linked current documentation above.

## Goal
Build a modern, AI-integrated resume and job-application support platform. The core product will focus on a premium structured resume-building workflow, PDF-first resume output, a .NET-owned document generation pipeline, optional Google Drive / OneDrive storage, and optional agent-ready integrations for advanced users who want to run their own local automation environment.

The application should not operate as a hosted, app-funded autonomous job-application agent in the initial product. Instead, the advanced agent feature should be designed as a bring-your-own-agent / bring-your-own-key workflow using user-owned infrastructure such as OpenClaw.

The application should also not attempt to become a full Google Docs / Microsoft Word clone. Most users should be able to enter structured resume data, choose a layout, let the app optimize the fit, and download polished PDF and Word-compatible versions.

## Core Features
1. A premium resume builder that collects and manages structured user job, education, skill, and profile information.
2. AI-assisted rewriting and resume suggestions using a user-configurable AI provider/API key.
3. PDF-first resume generation using app-controlled templates, layout rules, and server-side export.
4. Optional `.docx` compatibility export generated from the same structured resume data.
5. Optional Google Drive and OneDrive storage integrations for user-owned document storage.
6. Persistent structured user/profile/resume/application data stored in PostgreSQL through Entity Framework Core.
7. Pretext-powered layout intelligence for text measurement, template fit scoring, overflow warnings, and compact/standard/spacious layout presets.
8. Agent-ready exports that allow advanced users to hand off an application packet to their own local agent setup.
9. Future WebMCP support so external agents can interact with this app through structured, agent-readable actions instead of scraping the UI.

---

## Product Direction Decisions

### 0. Dependency Licensing Constraint
ApplyFill is currently source-available under its repository `LICENSE`; this planning document does not grant commercial resale or alter those terms. New runtime dependencies should nevertheless use permissive licenses that are compatible with the project's intended distribution model. Acceptable license families include MIT, Apache-2.0, BSD, PostgreSQL-style, and similarly permissive licenses, subject to review of each dependency and its transitive dependencies.

Do not use commercial document libraries or libraries with revenue-triggered commercial license requirements in the core product. Avoid LGPL/GPL/AGPL dependencies in the application runtime unless a future legal review explicitly approves a narrow use case.

Excluded from the preferred stack unless intentionally reconsidered later:
- QuestPDF, because its current licensing model includes revenue-based commercial licensing considerations.
- Aspose.Words, Syncfusion DocIO, GemBox.Document, Xceed Words, and similar commercial document libraries.
- CloudConvert, ConvertAPI, Microsoft Graph conversion, or Google Docs export as required core document-generation dependencies.
- Hangfire as the preferred job system, because LGPL is not the permissive license profile desired for this product.

Every new dependency should go through a license gate before adoption. The repository should maintain a `THIRD_PARTY_NOTICES.md` file and use automated license scanning in CI.

### 0A. Vite Frontend With a True .NET Backend
The application should use a real backend rather than treating the frontend framework as the whole application.

Preferred stack:
- Vite + React + TypeScript for the frontend.
- ASP.NET Core .NET 10 Web API for backend APIs.
- PostgreSQL for structured application data.
- Entity Framework Core for data access and migrations.
- Quartz.NET, Coravel, or ASP.NET Core worker services for background jobs.

This is a better fit for the product because the backend will own security-sensitive and workflow-heavy responsibilities such as OAuth token handling, encrypted AI key storage, document generation, optional Google Drive / OneDrive integration, application packet generation, audit logging, and background export jobs.

Next.js should not be used as the primary backend architecture for this project. If Next.js is used at all, it should only be considered as an alternative frontend delivery layer, not the preferred implementation path.

### 1. Resume Builder First, Not a Full Document Editor
The product should be treated as a structured resume builder, not a general-purpose document editor.

Most users do not need:
- embedded Google Docs editing inside the app
- a Word-like document engine
- drag-and-drop text boxes
- arbitrary page layout controls
- manual pagination controls
- real-time collaborative document editing

Most users need:
- structured resume data entry
- strong AI rewriting assistance
- good templates
- smart fit warnings
- polished PDF download
- Word-compatible download when needed
- simple optional storage in Google Drive / OneDrive

The app should therefore own the resume-building workflow and template system. PDF and DOCX should be app-generated export targets. Google Docs and Microsoft Word should be external editors users can open after export, not the primary source of truth or the in-app editing engine.

### 2. PDF-First Output
The primary polished artifact should be the PDF resume generated by the app's template/export system.

The PDF should be the version users rely on for:
- job applications
- email attachments
- application packets
- OpenClaw/local-agent resume upload
- final reviewed resume versions

The `.docx` version should be treated as an editable compatibility export. It does not need to be pixel-identical to the PDF, but it should be professionally formatted and usable for employers or recruiters who request a Word document. Users may optionally upload/open the DOCX in Google Docs or Microsoft Word outside the app.

Avoid this workflow:
1. Generate PDF.
2. Convert PDF to Word.

That often produces poor Word files with text boxes, layout artifacts, and bad editability.

Preferred workflow:
1. Store structured resume data in PostgreSQL.
2. Render the polished PDF from structured data and template rules.
3. Separately generate `.docx` compatibility versions from the same structured data.
4. Save generated artifacts to app-owned storage and optionally upload to Google Drive / OneDrive where applicable.

PDF and DOCX should be sibling exports from the same data, not conversions of each other.

### 3. Provider-Neutral Storage Integrations
The app should not rely on Google Docs, Microsoft Graph, or any third-party conversion API for core document generation. The .NET backend should own PDF and DOCX generation. Google Drive and OneDrive should be optional storage destinations only.

Initial storage provider:
- Google OAuth for sign-in and/or account linking.
- Google Drive for user-owned storage of generated PDF and DOCX files.
- Google Drive folder selection for resume exports.
- Gemini API as the preferred BYOK AI provider, if the user chooses Google for AI.

Google Docs role in the revised architecture:
- external editor that users may use after opening an exported DOCX/PDF from Drive
- not the core renderer
- not the in-app document engine
- not required for PDF/DOCX generation

Future storage provider:
- Microsoft sign-in / account linking.
- OneDrive/SharePoint document storage.
- Word for the web as an external editor after the user opens exported files.
- Azure OpenAI / Azure AI Foundry as an optional BYOK provider.

Microsoft Graph conversion should not be a core dependency. If used later, it should be an optional convenience path, not the authoritative export pipeline.

### 4. PostgreSQL Remains the Source of Truth for Structured Data
The application should store structured user data in PostgreSQL. Google Drive should store user-facing document artifacts, not structured resume/application data.

PostgreSQL should store:
- user profile data
- resume sections
- experience records
- education records
- skills
- AI rewrite history
- selected template and layout preset
- layout analysis results
- generated document metadata
- application packet metadata
- application history/log records

Google Drive / OneDrive should store:
- exported PDFs
- optional `.docx` exports
- application-specific resume versions
- user-visible document artifacts

### 5. Pretext Should Power Layout Intelligence, Not Replace Export Validation
Pretext should be used behind the scenes for resume-specific layout intelligence.

Use Pretext for:
- text measurement
- line-count estimation
- section height estimation
- template fit scoring
- compact/standard/spacious preset selection
- identifying bullets or sections likely to overflow
- comparing whether one-column or two-column templates fit better
- warning users before export

Pretext should not be treated as a full document engine or the final source of pagination truth.

The app should use Pretext to predict and optimize layout before export. The exported PDF remains the final reviewed artifact.

### 6. Server-Side PDF Generation Is Required
PDF generation should be handled server-side. The frontend should not be responsible for final PDF generation.

Preferred PDF-first workflow:
1. User edits structured resume data in the app.
2. Resume layout engine analyzes the content using template constraints and Pretext measurement.
3. App recommends a template and layout preset.
4. .NET backend renders the selected resume template to app-owned HTML/CSS.
5. Playwright for .NET renders the HTML/CSS to PDF using a controlled browser runtime.
6. Server validates page count and basic overflow conditions.
7. PDF is saved to app-owned storage and optionally uploaded to Google Drive / OneDrive if connected.
8. Metadata is stored in PostgreSQL.
9. Optional `.docx` compatibility export is generated separately from the same structured data.

Preferred core PDF engine:
- App-owned HTML/CSS templates rendered server-side by ASP.NET Core.
- Playwright for .NET for print-to-PDF.
- Optional Paged.js or similar open-source paged-media tooling only if deeper print-layout support is needed and the license is verified as permissive.

Fallback / utility option:
- PDFsharp / MigraDoc may be evaluated for low-level PDF utilities or a direct-PDF fallback, subject to license and capability review.

Do not use commercial PDF/document libraries or third-party conversion APIs as core generation dependencies.

### 7. Autonomous Application Filling Should Be an Advanced Integration, Not a Hosted Core Feature
The application should not host and pay for browser-agent usage as part of the initial product. Browser automation creates infrastructure, LLM, browser-runtime, proxy, logging, and support costs.

Instead, the app should support advanced users who want to use their own local agent environment.

Recommended advanced path:
- OpenClaw integration
- user-owned model/API key
- user-owned browser/runtime environment
- local browser control
- explicit user confirmation before final application submission

### 8. WebMCP Should Make This App Agent-Ready
WebMCP should not be treated as the primary solution for controlling third-party job application sites. Most job platforms will not immediately expose WebMCP-compatible tools.

The better near-term use is making this resume builder agent-ready. The app should expose structured actions that external agents can use to interact with the app more reliably than scraping the UI.

Potential future WebMCP actions:
- `get_user_profile`
- `get_resume_versions`
- `create_resume`
- `update_resume_section`
- `enhance_resume_bullet`
- `generate_cover_letter`
- `export_resume_pdf`
- `create_application_packet`
- `get_application_packet`


---

## Preferred Permissive Dependency Set

Initial dependencies should be limited to components with permissive licenses after verification.

Preferred core stack:
- ASP.NET Core / .NET runtime: MIT / Microsoft open-source licensing profile.
- Vite: MIT.
- React: MIT.
- Pretext: MIT.
- Entity Framework Core: MIT.
- Npgsql / Npgsql.EntityFrameworkCore.PostgreSQL: PostgreSQL-style permissive license.
- Playwright for .NET: MIT, with Playwright browser automation under permissive Microsoft licensing; browser-runtime redistribution should still be tracked in `THIRD_PARTY_NOTICES.md`.
- Open XML SDK: MIT.
- Quartz.NET: Apache-2.0.
- Coravel: MIT, if selected.
- PDFsharp / MigraDoc: evaluate as MIT-licensed optional utility/fallback, not as a required dependency until tested.

Dependency rules:
- Prefer app-owned code over convenience packages when the package license is unclear.
- Avoid GPL, AGPL, LGPL, SSPL, Commons Clause, Business Source License, revenue-threshold licenses, and paid/commercial libraries in the core runtime.
- Run automated license scanning in CI.
- Store license texts/notices for all distributed dependencies.
- Treat AI model APIs and cloud storage APIs as optional user-configured integrations, not required document-generation dependencies.
---

## Proposed Architecture

### Frontend
- Vite + React + TypeScript
- Premium Vanilla CSS, CSS Modules, or a light component system
- SPA-style resume builder dashboard and live preview
- Pretext-powered layout measurement in the preview/layout-analysis layer
- API client layer for calling the ASP.NET Core backend

### Backend
- ASP.NET Core .NET 10 Web API
- Controller-based or Minimal API endpoints, with a consistent REST-style route structure
- Service-layer architecture for resume, document, AI, Google, packet, and export workflows
- Background worker project for document generation, Drive sync, and longer-running jobs
- OpenAPI/Swagger documentation for internal and future external integrations

### Database
- PostgreSQL
- Entity Framework Core
- EF Core migrations for schema versioning

### Authentication
- Google OAuth for MVP
- Optional Microsoft OAuth adapter later

### Document Storage
- App-owned storage should be the default internal storage layer for generated artifacts.
- Google Drive should be offered as an optional user-owned storage destination for generated PDFs and DOCX files.
- OneDrive should be added later as an optional user-owned storage destination.
- Store provider file IDs, export metadata, document version metadata, and ownership metadata in PostgreSQL.
- Do not require Google Docs or Microsoft Graph conversion for core resume generation.

### Resume Editing Model
The app should use a structured editor, not an embedded full document editor.

The user edits:
- profile fields
- summary
- experience records
- bullets
- education
- skills
- certifications/projects optional future feature
- template selection
- layout preset selection

The app renders:
- live preview
- fit warnings
- PDF export
- compatibility exports

### Template and Layout Engine
Add a resume-specific layout engine.

Responsibilities:
- receive structured resume data
- receive selected template constraints
- measure text using Pretext where useful
- estimate section heights and line counts
- score templates against the user's content
- recommend compact/standard/spacious variants
- flag overflow risks
- identify specific fields causing layout issues
- pass final rendering instructions to the export engine

Example output:

```json
{
  "templateId": "modern-two-column",
  "layoutPreset": "compact",
  "estimatedPages": 1,
  "fits": true,
  "score": 91,
  "warnings": [
    {
      "section": "Experience",
      "field": "ResumeBullet:abc123",
      "message": "This bullet is projected to wrap to 3 lines."
    }
  ],
  "recommendedAdjustments": {
    "bodyFontSize": 9.75,
    "lineHeight": 13.25,
    "sectionSpacing": "compact"
  }
}
```

### PDF Export Engine
The PDF export engine should be the primary final output engine.

Responsibilities:
- render selected template with selected layout preset
- generate the final PDF server-side
- validate page count
- save the PDF to app-owned storage and optionally to Google Drive / OneDrive if connected
- persist export metadata in PostgreSQL

### Compatibility Export Engine
Compatibility exports should be generated separately from the same structured resume data.

Supported compatibility exports:
- `.docx` generated with the Open XML SDK or app-owned OpenXML template code
- optional upload of the generated `.docx` to Google Drive or OneDrive

Important rules:
- Do not convert the PDF into Word.
- Do not require Google Docs or Microsoft Graph conversion to create the Word-compatible export.
- Generate `.docx` directly from structured data and template rules.
- Treat Google Docs / Word for the web as external editors that users may open after the export is created.

### Open-Source Document Engine Decision
The core document pipeline should be owned by the application and built from permissive open-source components.

Primary PDF path:
- Render resume templates as deterministic HTML/CSS from the .NET backend.
- Use Playwright for .NET to generate the final PDF server-side.
- Keep CSS templates app-owned to avoid dependence on commercial document engines.
- Validate final PDF page count after generation.

Primary DOCX path:
- Generate `.docx` files directly using the Open XML SDK or app-owned OpenXML template utilities.
- Keep DOCX templates intentionally simpler than PDF templates where needed.
- Treat DOCX as an editable compatibility export, not the pixel-perfect canonical artifact.

Cloud storage role:
- Upload generated PDF/DOCX artifacts to Google Drive or OneDrive if the user links an account.
- Let users open the uploaded DOCX in Google Docs, Microsoft Word, or another editor themselves.
- Do not rely on Google Docs, Microsoft Graph conversion, or paid third-party APIs for document creation.

### AI Provider Strategy
The app should avoid app-funded autonomous-agent usage. AI should be configurable through BYOK where possible.

Initial AI support:
- Gemini API key supplied by the user, or
- app-configured Gemini API key only for limited non-agent resume-assistance features if the business model supports it

Optional future AI providers:
- OpenAI API key
- Anthropic API key
- Azure OpenAI / Azure AI Foundry endpoint and key

### Background Jobs
A background job system should be added instead of relying on long-running HTTP requests.

Recommended .NET options:
- ASP.NET Core hosted services / worker services for simple queues and background processing.
- Quartz.NET for scheduled jobs, recurring workflows, and persistent job scheduling.
- Coravel may be evaluated for lightweight scheduling/queuing if its capabilities are sufficient and license review remains clean.
- Temporal only if the workflow engine needs become materially more complex and its deployment/licensing profile is reviewed.

Avoid Hangfire as a preferred dependency because the core package is LGPL-licensed and does not match the desired permissive-license-only constraint.

Background jobs should handle:
- layout analysis if expensive
- PDF generation
- `.docx` export
- Google Docs creation/update
- Drive upload/sync
- application packet generation
- optional webhook callbacks from local/advanced agent workflows

---

## .NET Backend Service Recommendations

### Recommended Project Structure
Use a clean, saleable backend structure that separates API transport from business logic.

Suggested solution layout:

```text
ResumeBuilder.sln
  /src
    ResumeBuilder.Api
    ResumeBuilder.Application
    ResumeBuilder.Domain
    ResumeBuilder.Infrastructure
    ResumeBuilder.Worker
  /tests
    ResumeBuilder.Tests
```

### Backend Responsibilities
The ASP.NET Core backend should own:
- authentication/session validation
- Google OAuth token handling
- encrypted AI API key storage
- resume/profile CRUD operations
- template and layout-analysis orchestration
- server-side PDF generation jobs
- DOCX / Google Docs compatibility exports
- Google Drive upload/sync workflows
- application packet generation
- OpenClaw handoff package generation
- audit logging and user-owned data deletion workflows

### Frontend Responsibilities
The Vite frontend should own:
- dashboard UI
- structured resume editor
- live resume preview
- template selector
- layout warning display
- BYOK provider settings UI
- application packet UI
- download/export controls

The frontend should not own final document generation, OAuth token storage, AI key persistence, or application packet signing.

---

## Data Model Recommendations

### User
Stores authentication and account-level information.

Suggested fields:
- `id`
- `email`
- `name`
- `googleAccountId`
- `microsoftAccountId` optional future field
- `createdAt`
- `updatedAt`

### UserProfile
Stores reusable application/profile information.

Suggested fields:
- `id`
- `userId`
- `firstName`
- `lastName`
- `phone`
- `email`
- `city`
- `state`
- `linkedinUrl`
- `githubUrl`
- `portfolioUrl`
- `workAuthorizationStatus`
- `requiresSponsorship`
- `desiredCompensation`
- `createdAt`
- `updatedAt`

Sensitive fields should be carefully minimized and encrypted where appropriate.

### Resume
Stores the structured resume record.

Suggested fields:
- `id`
- `userId`
- `title`
- `summary`
- `targetRole`
- `targetIndustry`
- `selectedTemplateId`
- `selectedLayoutPreset`
- `isDefault`
- `createdAt`
- `updatedAt`

### ResumeExperience
Suggested fields:
- `id`
- `resumeId`
- `company`
- `title`
- `location`
- `startDate`
- `endDate`
- `isCurrent`
- `description`
- `sortOrder`

### ResumeBullet
Suggested fields:
- `id`
- `experienceId`
- `rawText`
- `enhancedText`
- `selectedText`
- `sortOrder`
- `aiProvider`
- `createdAt`
- `updatedAt`

### ResumeEducation
Suggested fields:
- `id`
- `resumeId`
- `school`
- `degree`
- `fieldOfStudy`
- `startDate`
- `endDate`
- `sortOrder`

### ResumeSkill
Suggested fields:
- `id`
- `resumeId`
- `category`
- `name`
- `sortOrder`

### ResumeTemplate
Stores available resume templates.

Suggested fields:
- `id`
- `name`
- `description`
- `templateType`
- `supportsOnePage`
- `supportsTwoPage`
- `supportsSidebar`
- `isActive`
- `createdAt`
- `updatedAt`

### ResumeLayoutAnalysis
Stores latest layout analysis result for a resume/template/preset combination.

Suggested fields:
- `id`
- `resumeId`
- `templateId`
- `layoutPreset`
- `estimatedPages`
- `fitsOnePage`
- `score`
- `warningsJson`
- `recommendedAdjustmentsJson`
- `createdAt`

### ResumeDocument
Stores generated artifact metadata.

Suggested fields:
- `id`
- `resumeId`
- `provider`
- `providerFileId`
- `providerFolderId`
- `documentType`
- `mimeType`
- `name`
- `version`
- `status`
- `createdAt`
- `updatedAt`

Example `documentType` values:
- `PDF`
- `DOCX`
- `GOOGLE_DOC`

### ApplicationPacket
Stores a generated packet for advanced agent workflows.

Suggested fields:
- `id`
- `userId`
- `resumeId`
- `targetJobUrl`
- `companyName`
- `jobTitle`
- `packetJson`
- `resumePdfFileId`
- `resumeDocxFileId`
- `resumeGoogleDocFileId`
- `status`
- `expiresAt`
- `createdAt`
- `updatedAt`

### ApplicationLog
Tracks application attempts, including manual and advanced-agent-assisted attempts.

Suggested fields:
- `id`
- `userId`
- `applicationPacketId`
- `targetJobUrl`
- `companyName`
- `jobTitle`
- `status`
- `submittedAt`
- `notes`
- `createdAt`
- `updatedAt`

---

## Proposed Changes

### 1. Database & Schema Setup
- Initialize PostgreSQL database.
- Add Entity Framework Core.
- Create models for:
  - `User`
  - `UserProfile`
  - `Resume`
  - `ResumeExperience`
  - `ResumeBullet`
  - `ResumeEducation`
  - `ResumeSkill`
  - `ResumeTemplate`
  - `ResumeLayoutAnalysis`
  - `ResumeDocument`
  - `ApplicationPacket`
  - `ApplicationLog`

### 2. Optional Cloud Storage Integrations
- Add Google OAuth sign-in/account linking for MVP if desired.
- Request limited Drive permissions.
- Prefer least-privilege scopes.
- Store Google account linkage in PostgreSQL.
- Allow user to choose or create a Drive folder for resume exports.
- Save generated PDFs and `.docx` files to the user's Drive.
- Add OneDrive storage later through a provider adapter.
- Do not rely on Google Docs or Microsoft Graph conversion for core document generation.

### 3. Resume Builder Frontend
- Build a premium dashboard for managing resume versions.
- Build a structured resume builder wizard.
- Add sections for:
  - personal/profile information
  - professional summary
  - experience
  - bullet points
  - education
  - skills
  - certifications/projects optional future feature
- Add AI assistance controls for bullet rewriting and summary suggestions.
- Add live preview using app-controlled resume templates.
- Add template selector.
- Add compact/standard/spacious layout presets.
- Add layout warnings that explain which fields are causing overflow risk.

### 4. Layout Intelligence With Pretext
Add a layout analysis layer using Pretext where useful.

The layout engine should:
- estimate line counts
- estimate section heights
- compare templates against the user's resume content
- recommend template/preset combinations
- warn when a section is likely to overflow
- identify overly long bullets or summaries
- prevent silent shrinking of body text below readable limits

Important UX rule:
- The app should assist the user with fit issues.
- The app should not silently shrink all text until the resume fits.

### 5. PDF-First Document Generation
- Generate the polished PDF server-side from app-controlled templates.
- Treat PDF as the primary finished artifact.
- Validate final page count after PDF generation.
- Save exported PDFs to app-owned storage and optionally to Google Drive / OneDrive if connected.
- Store document metadata in PostgreSQL.

### 6. Compatibility Exports
- Add `.docx` export as a compatibility option.
- Generate `.docx` directly with Open XML SDK/app-owned OpenXML template code.
- Upload the generated `.docx` to Google Drive / OneDrive if connected.
- Generate compatibility exports from structured resume data and template rules.
- Do not convert the PDF to Word.
- Do not make Google Docs or Microsoft Word the in-app editor engine for MVP.

### 7. AI Integration
- Add provider abstraction for AI calls.
- Start with Gemini BYOK support.
- Allow users to store an encrypted Gemini API key or enter it per session.
- Add optional OpenAI/Anthropic/Azure provider support later.
- Avoid app-funded autonomous-agent usage unless a future billing model is added.

### 8. Advanced Agent Integration
Replace the original hosted Playwright agent concept with an advanced user-owned integration.

The app should generate an `ApplicationPacket` containing:
- target job URL
- selected resume metadata
- resume PDF file link or temporary download URL
- optional resume DOCX / Google Doc link
- structured profile data
- work-history data
- application-answer preferences
- cover letter if generated
- explicit safety instructions
- final-submission approval requirement

The packet should be exportable as:
- JSON download
- signed API endpoint
- OpenClaw-compatible import format
- future WebMCP-readable action

### 9. OpenClaw Integration
Add an optional advanced integration path for users with their own OpenClaw setup.

The integration should support:
- exporting an application packet
- generating OpenClaw instructions
- providing a local-agent handoff URL or file
- including selected resume PDF/DOCX links
- requiring user confirmation before submission

The app should not host the OpenClaw runtime or pay for the model/runtime usage.

### 10. WebMCP Future Support
Add WebMCP to the roadmap as an agent-readiness layer for this app.

The app should expose structured agent actions such as:
- create/update resume
- retrieve resume versions
- export PDF
- create application packet
- fetch application packet

This should be treated as a way for external agents to interact with this app, not as the primary means of controlling third-party job application sites.

### 11. Application Dashboard
- Let users track application packets and application attempts.
- Allow users to mark an application as:
  - planned
  - packet generated
  - in progress
  - submitted
  - rejected
  - interview
  - withdrawn
- Allow notes and manual status updates.

---

## Backend API Endpoint Recommendations

These endpoints should be implemented in ASP.NET Core as controller actions or Minimal API route groups. The route names can remain REST-style `/api/...` routes; the important change is that they are backed by .NET services rather than Next.js API routes.

### Resume APIs
- `POST /api/resume/create`
- `GET /api/resume/list`
- `GET /api/resume/:id`
- `PATCH /api/resume/:id`
- `DELETE /api/resume/:id`

### Template and Layout APIs
- `GET /api/templates/list`
- `GET /api/templates/:id`
- `POST /api/resume/:id/analyze-layout`
- `GET /api/resume/:id/layout-analysis`
- `PATCH /api/resume/:id/template`
- `PATCH /api/resume/:id/layout-preset`

### AI APIs
- `POST /api/ai/enhance-bullet`
- `POST /api/ai/generate-summary`
- `POST /api/ai/generate-cover-letter`
- `POST /api/ai/test-provider-key`

### Document APIs
- `POST /api/documents/export-pdf`
- `POST /api/documents/export-docx`
- `POST /api/documents/save-to-drive`
- `POST /api/documents/save-to-onedrive` future
- `GET /api/documents/:id/status`
- `GET /api/documents/:id/download-link`

### Google Storage APIs
- `POST /api/google/connect`
- `POST /api/google/disconnect`
- `GET /api/google/drive-folders`
- `POST /api/google/select-export-folder`
- `POST /api/google/upload-document`

### Application Packet APIs
- `POST /api/application-packets/create`
- `GET /api/application-packets/:id`
- `GET /api/application-packets/:id/download-json`
- `POST /api/application-packets/:id/generate-openclaw-instructions`
- `POST /api/application-packets/:id/revoke`

### Future WebMCP APIs / Actions
- `get_user_profile`
- `get_resume_versions`
- `export_resume_pdf`
- `create_application_packet`
- `get_application_packet`

---

## Security Requirements

### OAuth and Permissions
- Use least-privilege Google OAuth scopes.
- Avoid broad Drive access unless absolutely necessary.
- Store OAuth tokens securely.
- Support disconnect/revoke flows.

### API Keys
- If storing user-provided AI API keys, encrypt them at rest.
- Allow users to delete stored keys.
- Consider a session-only key option where the key is never persisted.
- Never expose provider keys to the frontend after storage.

### Application Packets
Application packets may contain sensitive personal/profile data.

Requirements:
- signed URLs should expire
- packet access should be revocable
- packet exports should include warning text
- users should be able to delete packet history
- sensitive fields should be excluded unless explicitly enabled

### Agent Safety Rules
Any OpenClaw or local-agent instruction packet must require user confirmation before:
- submitting an application
- answering legal attestations
- answering EEO, disability, veteran, or demographic questions
- accepting terms
- authorizing background checks or credit checks
- creating accounts
- sending messages to employers
- changing account credentials

---

## Verification Plan

### Automated Tests
- Test Entity Framework Core schema, migrations, and CRUD operations.
- Test Google OAuth account linking.
- Test resume data serialization.
- Test Pretext/layout-analysis logic with fixture resumes.
- Test template scoring across one-column and two-column layouts.
- Test PDF generation from structured resume data.
- Test PDF page-count validation.
- Test `.docx` compatibility export.
- Test Drive upload workflow.
- Test document metadata persistence.
- Test AI provider abstraction with mocked providers.
- Test application packet generation.
- Test packet expiration and revocation.

### Manual Verification
- Verify Google sign-in works with the intended scopes.
- Verify live preview reasonably matches exported PDF.
- Verify layout warnings identify the correct problem sections.
- Verify compact/standard/spacious presets behave predictably.
- Verify generated PDFs retain premium layout and typography.
- Verify generated `.docx` files are acceptable as editable compatibility exports.
- Verify user can save documents to the selected Drive folder.
- Verify AI suggestions return polished professional text.
- Verify application packets contain the correct resume/profile/job data.
- Verify OpenClaw handoff instructions are clear enough for advanced users.
- Verify sensitive questions are flagged for mandatory user review.

### Advanced Agent Test Cases
Use dummy job-application forms first.

Test forms should include:
- basic contact fields
- resume upload
- work history
- education
- dropdowns
- radio buttons
- optional cover letter
- EEO/disability/veteran questions
- legal attestation
- final submit button

Expected result:
- local agent fills safe fields
- local agent uploads selected resume
- local agent pauses on sensitive fields
- local agent pauses before final submission

---

## Implementation Phases

### Phase 1: Core Resume Builder
- Vite + React + TypeScript frontend setup
- ASP.NET Core .NET 10 Web API setup
- PostgreSQL + Entity Framework Core setup
- Google OAuth sign-in
- structured resume/profile data models
- resume builder UI
- basic AI bullet enhancement through BYOK Gemini
- initial templates and live preview

### Phase 2: Layout Intelligence and PDF Export
- Pretext-powered layout analysis
- template fit scoring
- compact/standard/spacious presets
- server-side PDF generation
- PDF page-count validation
- app-owned storage for generated PDFs
- optional Google Drive storage for generated PDFs
- document version tracking

### Phase 3: Compatibility Exports
- `.docx` compatibility export
- Open XML SDK/app-owned `.docx` generation
- compatibility export metadata
- optional Drive/OneDrive storage for generated compatibility artifacts

### Phase 4: Application Packet System
- application packet model
- packet generation UI
- JSON export
- signed/revocable packet URL
- manual application tracking dashboard

### Phase 5: OpenClaw Advanced Integration
- OpenClaw handoff instructions
- OpenClaw-compatible application packet format
- local-agent safety rules
- dummy form test suite
- user documentation for advanced setup

### Phase 6: Agent-Ready App / WebMCP Roadmap
- expose structured agent actions
- prototype WebMCP support when practical
- allow external agents to call resume/export/application-packet actions
- keep WebMCP scoped to this app's own workflows first

### Phase 7: Microsoft Adapter
- Microsoft OAuth
- OneDrive document storage
- OneDrive document storage
- Microsoft Graph conversion only as optional future convenience, not core generation
- Azure OpenAI / Foundry BYOK support
- provider-switching UI

---

## Current Recommendation
Build the product as a structured, PDF-first resume builder with a Vite + React frontend, ASP.NET Core .NET 10 backend, PostgreSQL, and Entity Framework Core as the structured data layer.

Do not build a full document editor in the initial product.

Do not make Google Docs the core in-app document engine.

Do not build a hosted autonomous application agent in the initial product.

Instead:
1. Build the structured resume/profile system well.
2. Add template-based live preview.
3. Add Pretext-powered layout intelligence.
4. Generate polished PDFs server-side as the primary output.
5. Add `.docx` compatibility export using Open XML SDK/app-owned OpenXML code.
6. Save generated artifacts to app-owned storage, with optional Google Drive / OneDrive upload.
7. Add BYOK AI support.
8. Add application packet generation.
9. Add OpenClaw integration for advanced users.
10. Make the app agent-ready through future WebMCP support.
11. Add Microsoft support after the Google workflow is proven.

---

## Reference Notes
- The preferred stack is Vite + React + TypeScript on the frontend and ASP.NET Core .NET 10 Web API on the backend.
- Google Drive and OneDrive should be used for optional artifact storage and user-facing document access, not as the structured resume database or document-generation engine.
- Google Docs / Word for the web should be treated as external editors users may open after export, not as the primary in-app editor or core renderer.
- Pretext should be used for layout intelligence and fit prediction, not as a replacement for final PDF generation.
- PDF should be the primary polished artifact.
- DOCX should be generated from structured data as a compatibility export, not converted from the PDF. Google Docs/Word online access should happen after upload/opening, not as the core generator.
- Chrome/WebMCP-style support should be treated as a future agent-readiness layer for this app's own workflows.

---

## Work Experience Fields & Editor Improvements (Current Sprint)

This plan addresses the missing requirements for the Work Experience section, specifically adding location-based fields, contact information, supervisor details, and fixing the rich text editor's vertical height to be more usable.

### Proposed Changes

#### 1. Database & Backend Model
The domain entity `ResumeExperience.cs` currently has location and phone number fields, but is missing the supervisor details.
- **[MODIFY]** `m:/ResumeJobAssistant/src/ResumeBuilder.Domain/Entities/ResumeExperience.cs` to add:
  - `public string? SupervisorName { get; set; }`
  - `public bool MayContactSupervisor { get; set; }`
- **[NEW]** Generate a new Entity Framework Core migration (`AddSupervisorFields`) using the `dotnet ef migrations add` command.

#### 2. Frontend UI (`ExperienceSection.tsx`)
The UI needs to be updated to expose all of these fields in a clean, organized manner.
- **[MODIFY]** `m:/ResumeJobAssistant/frontend/src/components/resume/ExperienceSection.tsx`:
  - **Increase Editor Height**: Apply the shared Tiptap editor CSS to ensure the typing area has a `minHeight` of `300px` (up from `150px`).
  - **Add Form Fields**: Group the new inputs into logical sections using CSS Grid:
    - *Job Basics*: Title, Company, Start Date, End Date (already exists).
    - *Location*: Street Address 1, Street Address 2, City, State, Zip, Country.
    - *Contact/Supervisor*: Phone Number, Supervisor Name, "May we contact this employer?" (Checkbox).

### Verification Plan
1. **Database Verification**: Ensure `dotnet ef database update` succeeds and the new columns exist in the local PostgreSQL database.
2. **UI Verification**: Visually verify that the rich text editor is significantly larger, and that the new location, phone, and supervisor fields are present and correctly aligned in the wizard.
